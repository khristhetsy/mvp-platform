-- =====================================================================
-- STAGING ONLY — DO NOT RUN ON PRODUCTION.
-- This file is intentionally NOT in supabase/migrations/ so it never runs
-- automatically. Apply it to a STAGING copy, run the access tests below, and
-- only promote to production once every access path passes.
-- =====================================================================
--
-- WHAT THIS DOES (Step 3, risky half): swaps founder-scoped RLS from
-- `founder_id = auth.uid()` to org-based `is_member(org_id)`, giving multi-tenant
-- isolation between different owners' accounts.
--
-- WHAT THIS DOES NOT DO: scope a single user to their ACTIVE account. RLS can't
-- read the active-org cookie, so `is_member(org_id)` shows a multi-account user
-- data across ALL their orgs. Per-account scoping is the APP layer's job —
-- filter reads with getActiveOrgId() → `.eq("org_id", activeOrgId)`. Do that in
-- the same release, or a founder with two accounts sees both merged.
--
-- Only tables with a SINGLE, simple owner policy are safe to swap mechanically.
-- `companies` is NOT here — it has an interlocking policy set (founder + staff +
-- investor/marketplace + company_members) and needs per-policy analysis.
--
-- Before running: confirm the exact existing policy names on staging with
--   select policyname from pg_policies where tablename = '<table>';
-- and adjust the drop statements to match.

-- ── pipeline_investors ────────────────────────────────────────────────
-- Existing owner policy: "pipeline_investors_founder_own" (founder_id = auth.uid()).
drop policy if exists "pipeline_investors_founder_own" on public.pipeline_investors;
create policy pipeline_investors_org on public.pipeline_investors
  for all to authenticated
  using      (public.is_member(org_id))
  with check (public.is_member(org_id));

-- ── founder_investor_contacts ─────────────────────────────────────────
-- Replaces the four per-action owner policies with one org policy; KEEP the
-- separate staff-select policy (do not drop it).
drop policy if exists "founder_investor_contacts_select_own" on public.founder_investor_contacts;
drop policy if exists "founder_investor_contacts_insert_own" on public.founder_investor_contacts;
drop policy if exists "founder_investor_contacts_update_own" on public.founder_investor_contacts;
drop policy if exists "founder_investor_contacts_delete_own" on public.founder_investor_contacts;
create policy founder_investor_contacts_org on public.founder_investor_contacts
  for all to authenticated
  using      (public.is_member(org_id))
  with check (public.is_member(org_id));

-- =====================================================================
-- ACCESS TESTS (run on staging, as a real founder session, before promoting):
--   1. Founder A can read/write their own pipeline_investors + contacts.
--   2. Founder A CANNOT read Founder B's rows.
--   3. Staff can still read via the staff policy.
--   4. With app-layer getActiveOrgId() filtering, switching accounts changes
--      which rows appear (no cross-account bleed).
-- Add `companies`, `documents`, `diligence_reports`, `pitch_decks`,
-- `intro_requests`, `prospect_intro_requests` here ONLY after their policy sets
-- have been reviewed the same way.
-- =====================================================================
