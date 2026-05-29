-- Link platform data for admin dashboard and review workflow.

-- Normalize legacy role casing
update public.profiles
set role = lower(role)
where role is not null and role <> lower(role);

-- Company review fields
alter table public.companies
  add column if not exists review_status text default 'pending',
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by uuid references public.profiles(id);

-- Backfill review_status from legacy status where unset
update public.companies
set review_status = case
  when status in ('approved', 'published') then 'approved'
  when status = 'rejected' then 'rejected'
  when status = 'in_review' then 'pending'
  else coalesce(review_status, 'pending')
end
where review_status is null or review_status = 'pending';

-- Admin reviews: link founder + feedback
alter table public.admin_reviews
  add column if not exists founder_id uuid references public.profiles(id),
  add column if not exists feedback text,
  add column if not exists requested_changes text,
  add column if not exists updated_at timestamptz default now();

-- Backfill founder_id from companies
update public.admin_reviews ar
set founder_id = c.founder_id
from public.companies c
where ar.company_id = c.id
  and ar.founder_id is null;

-- Staff helper (admin / analyst)
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and lower(p.role) in ('admin', 'analyst')
  );
$$;

-- Investors see only approved companies
create or replace function public.company_is_approved(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.companies c
    where c.id = target_company_id
      and c.review_status = 'approved'
  );
$$;

-- Ensure FK constraints (idempotent)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'companies_founder_id_fkey'
  ) then
    alter table public.companies
      add constraint companies_founder_id_fkey
      foreign key (founder_id) references public.profiles(id);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'documents_company_id_fkey'
  ) then
    alter table public.documents
      add constraint documents_company_id_fkey
      foreign key (company_id) references public.companies(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'documents_uploaded_by_fkey'
  ) then
    alter table public.documents
      add constraint documents_uploaded_by_fkey
      foreign key (uploaded_by) references public.profiles(id);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'admin_reviews_company_id_fkey'
  ) then
    alter table public.admin_reviews
      add constraint admin_reviews_company_id_fkey
      foreign key (company_id) references public.companies(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'admin_reviews_founder_id_fkey'
  ) then
    alter table public.admin_reviews
      add constraint admin_reviews_founder_id_fkey
      foreign key (founder_id) references public.profiles(id);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'admin_reviews_reviewed_by_fkey'
  ) then
    alter table public.admin_reviews
      add constraint admin_reviews_reviewed_by_fkey
      foreign key (reviewed_by) references public.profiles(id);
  end if;
end $$;

create index if not exists companies_review_status_idx on public.companies (review_status);
create index if not exists admin_reviews_company_id_idx on public.admin_reviews (company_id);
create index if not exists admin_reviews_status_idx on public.admin_reviews (status);

-- RLS: staff policies (additive)
drop policy if exists "profiles_select_staff" on public.profiles;
create policy "profiles_select_staff"
  on public.profiles for select to authenticated
  using (public.is_staff());

drop policy if exists "companies_select_staff" on public.companies;
create policy "companies_select_staff"
  on public.companies for select to authenticated
  using (public.is_staff());

drop policy if exists "companies_select_investor_approved" on public.companies;
create policy "companies_select_investor_approved"
  on public.companies for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and lower(p.role) = 'investor'
    )
    and review_status = 'approved'
  );

drop policy if exists "companies_update_staff" on public.companies;
create policy "companies_update_staff"
  on public.companies for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists "documents_select_staff" on public.documents;
create policy "documents_select_staff"
  on public.documents for select to authenticated
  using (public.is_staff());

drop policy if exists "documents_select_investor_approved" on public.documents;
create policy "documents_select_investor_approved"
  on public.documents for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and lower(p.role) = 'investor'
    )
    and public.company_is_approved(company_id)
  );

drop policy if exists "admin_reviews_select_staff" on public.admin_reviews;
create policy "admin_reviews_select_staff"
  on public.admin_reviews for select to authenticated
  using (public.is_staff());

drop policy if exists "admin_reviews_select_founder" on public.admin_reviews;
create policy "admin_reviews_select_founder"
  on public.admin_reviews for select to authenticated
  using (
    founder_id = auth.uid()
    or exists (
      select 1 from public.companies c
      where c.id = company_id and c.founder_id = auth.uid()
    )
  );

drop policy if exists "admin_reviews_insert_staff" on public.admin_reviews;
create policy "admin_reviews_insert_staff"
  on public.admin_reviews for insert to authenticated
  with check (public.is_staff());

drop policy if exists "admin_reviews_update_staff" on public.admin_reviews;
create policy "admin_reviews_update_staff"
  on public.admin_reviews for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- Seed pending review rows for companies that have none
insert into public.admin_reviews (company_id, founder_id, status)
select c.id, c.founder_id, coalesce(c.review_status, 'pending')
from public.companies c
where not exists (
  select 1 from public.admin_reviews ar where ar.company_id = c.id
);
