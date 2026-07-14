-- Per-member forecast: a snapshot is partitioned by owner. owner_id NULL = the shared
-- org forecast (what managers/super admins see); a member's compute writes snapshots
-- scoped to their own open pipeline, visible only to them.

alter table public.sales_forecast_snapshots add column if not exists owner_id uuid references public.profiles(id) on delete cascade;
create index if not exists sales_forecast_snapshots_owner_idx on public.sales_forecast_snapshots (scenario_id, owner_id, computed_at desc);
