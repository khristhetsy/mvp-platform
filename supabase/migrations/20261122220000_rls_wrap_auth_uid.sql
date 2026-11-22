-- Wrap auth.uid() in (select ...) inside RLS policies so Postgres evaluates it once per
-- query instead of once per row (Supabase advisor: auth_rls_initplan). Each policy keeps
-- its command, roles and logic; only the auth.uid() call is wrapped. ALTER POLICY keeps
-- the policy name, command and role list.
--
-- NOTE: round_structures_owner_all and term_sheets_owner_all contain
-- (m.company_id = m.company_id), which is always true, so any company member passes the
-- company_members branch for every company. That is preserved here on purpose and
-- tracked as a separate fix.

alter policy "event_nudge_dismissals_delete_own" on public.event_nudge_dismissals
  using (user_id = (select auth.uid()));

alter policy "event_nudge_dismissals_select_own" on public.event_nudge_dismissals
  using (user_id = (select auth.uid()));

alter policy "event_nudge_dismissals_insert_own" on public.event_nudge_dismissals
  with check (user_id = (select auth.uid()));

alter policy "event_nudge_dismissals_update_own" on public.event_nudge_dismissals
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter policy "founder_read_own_premium_agreement" on public.premium_agreement_acceptances
  using (profile_id = (select auth.uid()));

alter policy "staff_read_premium_agreement" on public.premium_agreement_acceptances
  using (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.role = ANY (ARRAY['admin'::text, 'analyst'::text])))));

alter policy "round_structures_owner_all" on public.round_structures
  using ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = round_structures.company_id) AND (c.founder_id = (select auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM company_members m
  WHERE ((m.company_id = m.company_id) AND (m.user_id = (select auth.uid()))))))
  with check ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = round_structures.company_id) AND (c.founder_id = (select auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM company_members m
  WHERE ((m.company_id = m.company_id) AND (m.user_id = (select auth.uid()))))));

alter policy "term_sheets_owner_all" on public.term_sheets
  using ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = term_sheets.company_id) AND (c.founder_id = (select auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM company_members m
  WHERE ((m.company_id = m.company_id) AND (m.user_id = (select auth.uid()))))))
  with check ((EXISTS ( SELECT 1
   FROM companies c
  WHERE ((c.id = term_sheets.company_id) AND (c.founder_id = (select auth.uid()))))) OR (EXISTS ( SELECT 1
   FROM company_members m
  WHERE ((m.company_id = m.company_id) AND (m.user_id = (select auth.uid()))))));

alter policy "sales_ai_assignments_staff" on public.sales_ai_assignments
  using (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.role = ANY (ARRAY['admin'::text, 'analyst'::text])))))
  with check (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.role = ANY (ARRAY['admin'::text, 'analyst'::text])))));

alter policy "sales_ai_documents_staff" on public.sales_ai_documents
  using (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.role = ANY (ARRAY['admin'::text, 'analyst'::text])))))
  with check (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.role = ANY (ARRAY['admin'::text, 'analyst'::text])))));

alter policy "sales_ai_drafts_staff" on public.sales_ai_drafts
  using (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.role = ANY (ARRAY['admin'::text, 'analyst'::text])))))
  with check (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.role = ANY (ARRAY['admin'::text, 'analyst'::text])))));

alter policy "sales_ai_examples_staff" on public.sales_ai_examples
  using (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.role = ANY (ARRAY['admin'::text, 'analyst'::text])))))
  with check (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.role = ANY (ARRAY['admin'::text, 'analyst'::text])))));

alter policy "sales_ai_queue_items_staff" on public.sales_ai_queue_items
  using (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.role = ANY (ARRAY['admin'::text, 'analyst'::text])))))
  with check (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.role = ANY (ARRAY['admin'::text, 'analyst'::text])))));

alter policy "sales_ai_settings_staff" on public.sales_ai_settings
  using (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.role = ANY (ARRAY['admin'::text, 'analyst'::text])))))
  with check (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.role = ANY (ARRAY['admin'::text, 'analyst'::text])))));

alter policy "sales_ai_stage_suggestions_staff" on public.sales_ai_stage_suggestions
  using (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.role = ANY (ARRAY['admin'::text, 'analyst'::text])))))
  with check (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.role = ANY (ARRAY['admin'::text, 'analyst'::text])))));

alter policy "staff_full_access" on public.social_finder_hits
  using (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.role = ANY (ARRAY['admin'::text, 'analyst'::text])))))
  with check (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.role = ANY (ARRAY['admin'::text, 'analyst'::text])))));

alter policy "staff_full_access" on public.social_finder_signals
  using (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.role = ANY (ARRAY['admin'::text, 'analyst'::text])))))
  with check (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.role = ANY (ARRAY['admin'::text, 'analyst'::text])))));

alter policy "staff_full_access" on public.social_group_share_items
  using (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.role = ANY (ARRAY['admin'::text, 'analyst'::text])))))
  with check (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.role = ANY (ARRAY['admin'::text, 'analyst'::text])))));

alter policy "staff_full_access" on public.social_group_shares
  using (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.role = ANY (ARRAY['admin'::text, 'analyst'::text])))))
  with check (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.role = ANY (ARRAY['admin'::text, 'analyst'::text])))));

alter policy "staff_full_access" on public.social_groups
  using (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.role = ANY (ARRAY['admin'::text, 'analyst'::text])))))
  with check (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.role = ANY (ARRAY['admin'::text, 'analyst'::text])))));

alter policy "staff_full_access" on public.social_site_audits
  using (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.role = ANY (ARRAY['admin'::text, 'analyst'::text])))))
  with check (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = (select auth.uid())) AND (p.role = ANY (ARRAY['admin'::text, 'analyst'::text])))));
