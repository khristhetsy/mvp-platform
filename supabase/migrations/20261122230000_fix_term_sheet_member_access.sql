-- Fix cross-company access on term_sheets and round_structures.
--
-- The *_owner_all policies let a company member through with
--   m.company_id = m.company_id
-- which compares the membership row to itself and is always true. Any user who belongs to
-- any company could therefore read and change every company's term sheets and round
-- structures. The member branch now requires the membership to be for the row's own company.
-- Founder access and the staff read policies are unchanged.
--
-- Apply after 20261122220000_rls_wrap_auth_uid.sql (same policies, wrapped auth.uid()).

alter policy "term_sheets_owner_all" on public.term_sheets
  using (
    (EXISTS ( SELECT 1 FROM companies c WHERE ((c.id = term_sheets.company_id) AND (c.founder_id = (select auth.uid())))))
    OR (EXISTS ( SELECT 1 FROM company_members m WHERE ((m.company_id = term_sheets.company_id) AND (m.user_id = (select auth.uid())))))
  )
  with check (
    (EXISTS ( SELECT 1 FROM companies c WHERE ((c.id = term_sheets.company_id) AND (c.founder_id = (select auth.uid())))))
    OR (EXISTS ( SELECT 1 FROM company_members m WHERE ((m.company_id = term_sheets.company_id) AND (m.user_id = (select auth.uid())))))
  );

alter policy "round_structures_owner_all" on public.round_structures
  using (
    (EXISTS ( SELECT 1 FROM companies c WHERE ((c.id = round_structures.company_id) AND (c.founder_id = (select auth.uid())))))
    OR (EXISTS ( SELECT 1 FROM company_members m WHERE ((m.company_id = round_structures.company_id) AND (m.user_id = (select auth.uid())))))
  )
  with check (
    (EXISTS ( SELECT 1 FROM companies c WHERE ((c.id = round_structures.company_id) AND (c.founder_id = (select auth.uid())))))
    OR (EXISTS ( SELECT 1 FROM company_members m WHERE ((m.company_id = round_structures.company_id) AND (m.user_id = (select auth.uid())))))
  );
