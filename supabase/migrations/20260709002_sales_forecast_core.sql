-- Sales Hub — Forecast & Projection module, batch A (forecast core).
-- Convention: RLS enabled with NO policy → service-role only; all access via admin
-- API routes gated by requireRole(["admin","analyst"]). Immutability (snapshots) is
-- enforced by a trigger so it holds even against the service role.
-- Segments use the subscription `role` vocabulary: 'founder' | 'investor' (or null = global).

-- ── Scenarios ────────────────────────────────────────────────────────────────
create table if not exists public.sales_forecast_scenarios (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  kind           text not null default 'custom' check (kind in ('base','upside','downside','custom')),
  horizon_months int  not null default 36 check (horizon_months between 1 and 120),
  start_month    date not null default date_trunc('month', now())::date,
  is_active      boolean not null default false,
  notes          text,
  created_by     uuid references public.profiles(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
-- At most one active scenario per kind (drives CEO Base headline + default selection).
create unique index if not exists sales_forecast_scenarios_active_kind
  on public.sales_forecast_scenarios (kind) where is_active;
alter table public.sales_forecast_scenarios enable row level security;

-- ── Assumptions (driver grid) ────────────────────────────────────────────────
create table if not exists public.sales_forecast_assumptions (
  id          uuid primary key default gen_random_uuid(),
  scenario_id uuid not null references public.sales_forecast_scenarios(id) on delete cascade,
  driver_key  text not null,
  segment     text check (segment in ('founder','investor','hot','warm','cold')),
  month_from  int  not null default 0 check (month_from >= 0),
  month_to    int  not null default 0 check (month_to >= month_from),
  value       numeric not null,
  updated_by  uuid references public.profiles(id),
  updated_at  timestamptz not null default now()
);
-- Most-specific match keyed on (scenario, driver, segment, month_from); null segment = global.
create unique index if not exists sales_forecast_assumptions_uniq
  on public.sales_forecast_assumptions (scenario_id, driver_key, coalesce(segment, ''), month_from);
create index if not exists sales_forecast_assumptions_scenario_idx
  on public.sales_forecast_assumptions (scenario_id);
alter table public.sales_forecast_assumptions enable row level security;

-- ── Snapshots (immutable) ────────────────────────────────────────────────────
create table if not exists public.sales_forecast_snapshots (
  id               uuid primary key default gen_random_uuid(),
  scenario_id      uuid not null references public.sales_forecast_scenarios(id) on delete cascade,
  computed_at      timestamptz not null default now(),
  engine_version   text not null,
  assumptions_hash text not null,
  output           jsonb not null,
  created_by       uuid references public.profiles(id)
);
create index if not exists sales_forecast_snapshots_scenario_idx
  on public.sales_forecast_snapshots (scenario_id, computed_at desc);
alter table public.sales_forecast_snapshots enable row level security;

-- Immutability: block UPDATE/DELETE on snapshots (even for service role).
create or replace function public.sales_forecast_block_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'sales_forecast_snapshots rows are immutable (% blocked)', tg_op;
end;
$$;
drop trigger if exists sales_forecast_snapshots_immutable on public.sales_forecast_snapshots;
create trigger sales_forecast_snapshots_immutable
  before update or delete on public.sales_forecast_snapshots
  for each row execute function public.sales_forecast_block_mutation();

-- ── Pipeline weights (per real CRM stage) ────────────────────────────────────
create table if not exists public.sales_forecast_pipeline_weights (
  id               uuid primary key default gen_random_uuid(),
  stage_id         uuid not null references public.sales_stages(id) on delete cascade,
  win_probability  numeric not null default 0 check (win_probability between 0 and 1),
  expected_lag_days int not null default 30 check (expected_lag_days >= 0),
  is_active        boolean not null default true,
  updated_by       uuid references public.profiles(id),
  updated_at       timestamptz not null default now(),
  unique (stage_id)
);
alter table public.sales_forecast_pipeline_weights enable row level security;

-- ── Targets (v1-optional; empty until used) ──────────────────────────────────
create table if not exists public.sales_forecast_targets (
  id           uuid primary key default gen_random_uuid(),
  metric_key   text not null,
  month        int  not null check (month >= 0),
  segment      text check (segment in ('founder','investor','hot','warm','cold')),
  target_value numeric not null,
  created_by   uuid references public.profiles(id),
  created_at   timestamptz not null default now()
);
-- Expression unique (null segment = global) — can't live in a table-level constraint.
create unique index if not exists sales_forecast_targets_uniq
  on public.sales_forecast_targets (metric_key, month, coalesce(segment, ''));
alter table public.sales_forecast_targets enable row level security;

-- ── Actuals view — monthly recurring-revenue roll-up from real billing ────────
-- Source of truth: public.subscriptions (one row per profile). We lack per-month MRR
-- history, so new/churned MRR are derived from created_at / churn month, and ending
-- MRR is a running cumulative of (new − churned). Segment = subscription role.
create or replace view public.v_sales_forecast_actuals as
with months as (
  select generate_series(
           date_trunc('month', coalesce((select min(created_at) from public.subscriptions), now())),
           date_trunc('month', now()),
           interval '1 month'
         )::date as month
),
seg(segment) as (values ('founder'), ('investor')),
grid as (
  select m.month, s.segment from months m cross join seg s
),
new_m as (
  select date_trunc('month', created_at)::date as month,
         role as segment,
         count(*) as new_subs,
         coalesce(sum(monthly_price_cents), 0)::bigint as new_mrr_cents
  from public.subscriptions
  where role in ('founder','investor') and monthly_price_cents > 0
  group by 1, 2
),
churn_m as (
  select date_trunc('month', updated_at)::date as month,
         role as segment,
         count(*) as churned_subs,
         coalesce(sum(monthly_price_cents), 0)::bigint as churned_mrr_cents
  from public.subscriptions
  where role in ('founder','investor')
    and subscription_status in ('canceled','expired')
  group by 1, 2
)
select
  g.month,
  g.segment,
  coalesce(n.new_subs, 0)          as new_subs,
  coalesce(n.new_mrr_cents, 0)     as new_mrr_cents,
  coalesce(c.churned_subs, 0)      as churned_subs,
  coalesce(c.churned_mrr_cents, 0) as churned_mrr_cents,
  sum(coalesce(n.new_subs, 0) - coalesce(c.churned_subs, 0))
    over (partition by g.segment order by g.month)      as active_subs,
  sum(coalesce(n.new_mrr_cents, 0) - coalesce(c.churned_mrr_cents, 0))
    over (partition by g.segment order by g.month)      as ending_mrr_cents
from grid g
left join new_m   n on n.month = g.month and n.segment = g.segment
left join churn_m c on c.month = g.month and c.segment = g.segment
order by g.month, g.segment;
