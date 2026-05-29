-- Marketplace publication fields on companies.

alter table public.companies
  add column if not exists is_published boolean not null default false,
  add column if not exists marketplace_visible boolean not null default false,
  add column if not exists published_at timestamptz,
  add column if not exists slug text;

create unique index if not exists companies_slug_unique_idx
  on public.companies (slug)
  where slug is not null;

-- Generate slugs for existing companies
update public.companies c
set slug = sub.slug
from (
  select
    id,
    trim(both '-' from regexp_replace(lower(coalesce(company_name, 'company')), '[^a-z0-9]+', '-', 'g'))
      || case
        when count(*) over (partition by trim(both '-' from regexp_replace(lower(coalesce(company_name, 'company')), '[^a-z0-9]+', '-', 'g'))) > 1
        then '-' || left(replace(id::text, '-', ''), 8)
        else ''
      end as slug
  from public.companies
) sub
where c.id = sub.id
  and (c.slug is null or c.slug = '');

-- Backfill marketplace flags for already-approved companies (optional visibility off until republished)
update public.companies
set review_status = coalesce(review_status, 'pending')
where review_status is null;

-- Publish companies that were approved before marketplace columns existed
update public.companies
set
  is_published = true,
  marketplace_visible = true,
  published_at = coalesce(published_at, approved_at, now()),
  status = case when status = 'approved' then 'published' else status end
where review_status = 'approved'
  and (is_published = false or marketplace_visible = false or published_at is null);

-- Investors: only marketplace-visible approved listings
drop policy if exists "companies_select_investor_approved" on public.companies;
create policy "companies_select_investor_approved"
  on public.companies for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and lower(p.role) = 'investor'
    )
    and review_status = 'approved'
    and is_published = true
    and marketplace_visible = true
    and published_at is not null
  );

-- Anonymous/public marketplace reads via authenticated investors only in RLS;
-- server pages use service role for public /deals listing.
