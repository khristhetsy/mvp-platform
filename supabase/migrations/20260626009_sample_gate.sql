-- Migration: 20260626009_sample_gate.sql
-- Sample-board gate: an explicit is_sample flag so test/demo companies never
-- reach public surfaces (homepage stats, /deals, public board), independent of
-- name heuristics. Real published deals are unaffected.

alter table public.companies
  add column if not exists is_sample boolean not null default false;
create index if not exists companies_is_sample_idx on public.companies(is_sample) where is_sample = true;

-- Backfill obvious test/demo rows so they're gated immediately. Conservative:
-- only matches clear demo names; real companies are never auto-flagged.
update public.companies
set is_sample = true
where is_sample = false
  and (
    company_name ~* '\m(test|demo|sample|mock|placeholder|lorem)\M'
    or company_name ilike 'acme%'
    or company_name ilike 'roy company%'
    or company_name ilike 'johnny rivera%'
    or company_name ilike 'jessica santos%'
    or company_name ilike 'jane founder%'
  );

-- Defense in depth: logged-in investors shouldn't see sample deals either.
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
    and is_sample = false
  );
