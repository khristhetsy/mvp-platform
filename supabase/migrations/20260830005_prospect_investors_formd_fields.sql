-- Form D Desk — Investor Mode · fields + access for the Form D promote path (§9).
-- Adds the columns promote_prospect_investor() writes, and the STAFF access
-- policies that must exist alongside the RLS enabled in 20260830004 — otherwise
-- enabling RLS locks staff out of a live table. REVIEW 004 + this together against
-- current prospect_investors usage before running. Additive + idempotent.

create extension if not exists pg_trgm;

alter table public.prospect_investors
  add column if not exists status           text default 'New',
  add column if not exists lawful_basis     text,          -- GDPR basis, set at promote time (§15)
  add column if not exists activity_band    text,          -- carried from the firm at promote time
  add column if not exists domain           text,
  add column if not exists firm_stem        text,
  add column if not exists state_or_country text,
  -- Open question 2 resolved: promoted Form D firms join the 6,000+ investor list
  -- (segment 'distribution'). The 'research' segment stays available for anything a
  -- human wants to hold back. NOTE (§15): securities counsel must review the
  -- outbound script + fee structure before the first campaign — that gate is on
  -- outbound, not on promote.
  add column if not exists segment          text not null default 'distribution'
    check (segment in ('research', 'distribution'));

create index if not exists prospect_investors_firm_stem_idx
  on public.prospect_investors (firm_stem, coalesce(state_or_country, ''));
create index if not exists prospect_investors_domain_idx
  on public.prospect_investors (domain);

-- Staff can read and manage the prospecting table (mirrors the contacts rule).
-- Insert/update stay with the authenticated staff user; service role is blocked
-- for insert by 20260830004.
drop policy if exists prospect_investors_staff_select on public.prospect_investors;
create policy prospect_investors_staff_select on public.prospect_investors
  for select using (public.is_staff());

drop policy if exists prospect_investors_staff_insert on public.prospect_investors;
create policy prospect_investors_staff_insert on public.prospect_investors
  for insert to authenticated with check (public.is_staff());

drop policy if exists prospect_investors_staff_update on public.prospect_investors;
create policy prospect_investors_staff_update on public.prospect_investors
  for update using (public.is_staff()) with check (public.is_staff());
