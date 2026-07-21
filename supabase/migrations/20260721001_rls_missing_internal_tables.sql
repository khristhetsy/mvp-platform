-- Enable RLS on three internal tables that were created without it.
--
-- All three are read and written through the service-role client, which bypasses
-- RLS entirely, so these policies do not change how the application behaves.
-- What they change is the anon/authenticated path: without RLS these tables are
-- reachable with the public anon key.
--
-- sales_bulk_assign_audit is the one that matters most. It records actor_id for
-- bulk lead assignment, and without RLS a caller holding the anon key could
-- insert forged rows. An audit log that can be written by the party it audits is
-- worse than no audit log, because it is trusted.

-- ── sales_bulk_assign_audit ──────────────────────────────────────────────────
alter table public.sales_bulk_assign_audit enable row level security;

drop policy if exists "sales_bulk_assign_audit_select_staff" on public.sales_bulk_assign_audit;
create policy "sales_bulk_assign_audit_select_staff"
  on public.sales_bulk_assign_audit for select to authenticated
  using (public.is_staff());

-- Deliberately no insert/update/delete policy: writes go through the service
-- role. Append-only from the application's perspective, immutable from any
-- client session.

-- ── marketing_settings ───────────────────────────────────────────────────────
alter table public.marketing_settings enable row level security;

drop policy if exists "marketing_settings_select_staff" on public.marketing_settings;
create policy "marketing_settings_select_staff"
  on public.marketing_settings for select to authenticated
  using (public.is_staff());

drop policy if exists "marketing_settings_write_staff" on public.marketing_settings;
create policy "marketing_settings_write_staff"
  on public.marketing_settings for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- ── crm_facet_cache ──────────────────────────────────────────────────────────
-- Derived cache of CRM filter option lists. Contents are aggregated contact
-- attributes, so staff-only read is appropriate.
alter table public.crm_facet_cache enable row level security;

drop policy if exists "crm_facet_cache_select_staff" on public.crm_facet_cache;
create policy "crm_facet_cache_select_staff"
  on public.crm_facet_cache for select to authenticated
  using (public.is_staff());
