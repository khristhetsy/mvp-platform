-- Explicit staff policies for the CRM automation tables (Nov 14, 2026).
-- The tables were created with RLS on and no policies, so only the server (service
-- role) could read or write them. This adds the policies the repo rules ask for:
-- staff (admin and analyst) can read and write; founders and investors get nothing.
-- The app itself still goes through the service role, so behavior does not change.

create policy "staff manage automation rules" on public.sales_automation_rules
  for all using (public.is_staff()) with check (public.is_staff());
create policy "staff manage automation events" on public.sales_automation_events
  for all using (public.is_staff()) with check (public.is_staff());
create policy "staff manage automation approvals" on public.sales_automation_approvals
  for all using (public.is_staff()) with check (public.is_staff());
