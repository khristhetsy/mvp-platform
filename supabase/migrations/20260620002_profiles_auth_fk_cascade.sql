-- PERMANENT FIX: user-deletion referential integrity (core graph).
--
-- Two recurring symptoms had one root cause — no consistent on-delete policy
-- between auth.users, profiles, and the data that references a user:
--   1. Deleting an auth user orphaned its profile (admin list drifts vs Auth),
--      because profiles.id had no FK to auth.users at all.
--   2. Deleting a profile failed, because companies.founder_id (and a few
--      company-child FKs) had no cascade.
--
-- Policy (chosen): OWNED data cascades with the user; ACTOR/audit references are
-- set null so history is preserved. This migration applies that policy across
-- the core (0001) graph, removes existing orphan profiles, and finally adds the
-- profiles -> auth.users cascade so drift is structurally impossible.
--
-- Constraint names follow Postgres' inline convention (<table>_<column>_fkey).
-- All steps are idempotent (drop-if-exists before re-add).

-- ── 1. Company-owned data cascades when the company is deleted ────────────────
alter table public.documents
  drop constraint if exists documents_company_id_fkey,
  add constraint documents_company_id_fkey
    foreign key (company_id) references public.companies(id) on delete cascade;

alter table public.diligence_reports
  drop constraint if exists diligence_reports_company_id_fkey,
  add constraint diligence_reports_company_id_fkey
    foreign key (company_id) references public.companies(id) on delete cascade;

alter table public.campaigns
  drop constraint if exists campaigns_company_id_fkey,
  add constraint campaigns_company_id_fkey
    foreign key (company_id) references public.companies(id) on delete cascade;

alter table public.admin_reviews
  drop constraint if exists admin_reviews_company_id_fkey,
  add constraint admin_reviews_company_id_fkey
    foreign key (company_id) references public.companies(id) on delete cascade;

alter table public.investor_interests
  drop constraint if exists investor_interests_company_id_fkey,
  add constraint investor_interests_company_id_fkey
    foreign key (company_id) references public.companies(id) on delete cascade;

-- ── 2. User-owned data cascades; actor/audit references set null ──────────────
-- Owned: a founder owns their company; an investor owns their expressed interest.
alter table public.companies
  drop constraint if exists companies_founder_id_fkey,
  add constraint companies_founder_id_fkey
    foreign key (founder_id) references public.profiles(id) on delete cascade;

alter table public.investor_interests
  drop constraint if exists investor_interests_investor_id_fkey,
  add constraint investor_interests_investor_id_fkey
    foreign key (investor_id) references public.profiles(id) on delete cascade;

-- Actor/audit: preserve the record, null out the deleted person.
alter table public.documents
  drop constraint if exists documents_uploaded_by_fkey,
  add constraint documents_uploaded_by_fkey
    foreign key (uploaded_by) references public.profiles(id) on delete set null;

alter table public.admin_reviews
  drop constraint if exists admin_reviews_reviewed_by_fkey,
  add constraint admin_reviews_reviewed_by_fkey
    foreign key (reviewed_by) references public.profiles(id) on delete set null;

alter table public.audit_logs
  drop constraint if exists audit_logs_user_id_fkey,
  add constraint audit_logs_user_id_fkey
    foreign key (user_id) references public.profiles(id) on delete set null;

-- ── 3. Remove existing orphan profiles (now cascades cleanly via step 1+2) ─────
delete from public.profiles p
where not exists (select 1 from auth.users u where u.id = p.id);

-- ── 4. Tie profiles to auth.users — deleting an auth user removes its profile ──
alter table public.profiles
  drop constraint if exists profiles_id_fkey,
  add constraint profiles_id_fkey
    foreign key (id) references auth.users(id) on delete cascade;
