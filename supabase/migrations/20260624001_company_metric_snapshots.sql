-- Phase 3: time-series snapshots for the Investor Private Market.
-- Powers the readiness trend sparkline (Δ over time) and the "filling fast"
-- velocity metric. Written by the orchestration cron via the service-role
-- client (which bypasses RLS); read by authenticated workspace users.
--
-- Idempotent: safe to re-run.

create table if not exists public.company_metric_snapshots (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  captured_at timestamptz not null default now(),
  capture_date date not null default (now() at time zone 'utc')::date,
  readiness_score numeric,
  total_indicated numeric not null default 0,
  created_at timestamptz not null default now()
);

-- One snapshot per company per UTC day; re-running the cron upserts this row.
create unique index if not exists company_metric_snapshots_company_day_idx
  on public.company_metric_snapshots (company_id, capture_date);

-- Fast "latest N snapshots for a company" lookups for the sparkline / deltas.
create index if not exists company_metric_snapshots_company_captured_idx
  on public.company_metric_snapshots (company_id, captured_at desc);

alter table public.company_metric_snapshots enable row level security;

-- Aggregate signals already surfaced on the board; readable to signed-in users.
drop policy if exists "metric snapshots readable" on public.company_metric_snapshots;
create policy "metric snapshots readable"
  on public.company_metric_snapshots
  for select
  to authenticated
  using (true);
