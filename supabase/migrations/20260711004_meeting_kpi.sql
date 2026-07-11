-- Weekly Meeting System — Step 4 (KPI engine).
-- Purpose-built KPI layer in the ceo_kpi_* family: per-department, per-agent weekly
-- "Data Input", with auto/pinned/ratchet goals and materialized goal values. Leaves the
-- CEO Hub's own ceo_kpi_registry/ceo_kpi_snapshots untouched. is_staff() RLS throughout.

create table if not exists public.ceo_kpi_meeting_definitions (
  id            uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete cascade,
  key           text not null,
  label         text not null,
  unit          text not null default 'count' check (unit in ('count','percent','currency')),
  position      int not null default 0,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  unique (department_id, key)
);
alter table public.ceo_kpi_meeting_definitions enable row level security;
drop policy if exists ceo_kpi_meeting_definitions_staff on public.ceo_kpi_meeting_definitions;
create policy ceo_kpi_meeting_definitions_staff on public.ceo_kpi_meeting_definitions for all to authenticated using (public.is_staff()) with check (public.is_staff());

create table if not exists public.ceo_kpi_meeting_entries (
  id         uuid primary key default gen_random_uuid(),
  kpi_id     uuid not null references public.ceo_kpi_meeting_definitions(id) on delete cascade,
  agent_id   uuid references public.profiles(id),   -- null = department-level
  week_start date not null,                          -- Monday
  value      numeric not null,
  entered_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  unique (kpi_id, agent_id, week_start)
);
create index if not exists ceo_kpi_meeting_entries_kpi_idx on public.ceo_kpi_meeting_entries (kpi_id, week_start);
alter table public.ceo_kpi_meeting_entries enable row level security;
drop policy if exists ceo_kpi_meeting_entries_staff on public.ceo_kpi_meeting_entries;
create policy ceo_kpi_meeting_entries_staff on public.ceo_kpi_meeting_entries for all to authenticated using (public.is_staff()) with check (public.is_staff());

create table if not exists public.ceo_kpi_meeting_goals (
  id            uuid primary key default gen_random_uuid(),
  kpi_id        uuid not null references public.ceo_kpi_meeting_definitions(id) on delete cascade,
  period        text not null check (period in ('weekly','monthly','quarterly','yearly')),
  mode          text not null default 'auto' check (mode in ('auto','pinned')),
  pinned_value  numeric,
  pinned_by     uuid references public.profiles(id),
  growth_factor numeric not null default 1.10,
  ratchet_only  boolean not null default false,
  unique (kpi_id, period)
);
alter table public.ceo_kpi_meeting_goals enable row level security;
drop policy if exists ceo_kpi_meeting_goals_staff on public.ceo_kpi_meeting_goals;
create policy ceo_kpi_meeting_goals_staff on public.ceo_kpi_meeting_goals for all to authenticated using (public.is_staff()) with check (public.is_staff());

create table if not exists public.ceo_kpi_meeting_goal_values (
  id           uuid primary key default gen_random_uuid(),
  kpi_id       uuid not null references public.ceo_kpi_meeting_definitions(id) on delete cascade,
  period       text not null,
  period_start date not null,
  value        numeric not null,
  unique (kpi_id, period, period_start)
);
alter table public.ceo_kpi_meeting_goal_values enable row level security;
drop policy if exists ceo_kpi_meeting_goal_values_staff on public.ceo_kpi_meeting_goal_values;
create policy ceo_kpi_meeting_goal_values_staff on public.ceo_kpi_meeting_goal_values for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- ── Auto-goal: trailing-average × growth (or pinned / ratchet) ───────────────
create or replace function public.calc_meeting_kpi_goal(p_kpi_id uuid, p_period text, p_as_of date)
returns numeric language plpgsql stable security definer set search_path = public as $$
declare g record; base numeric; result numeric; cur numeric;
begin
  select * into g from public.ceo_kpi_meeting_goals where kpi_id = p_kpi_id and period = p_period;
  if g.mode = 'pinned' then return coalesce(g.pinned_value, 0); end if;

  if p_period = 'weekly' then
    select avg(t) into base from (
      select sum(value) t from public.ceo_kpi_meeting_entries
      where kpi_id = p_kpi_id and week_start < date_trunc('week', p_as_of)::date
        and week_start >= (date_trunc('week', p_as_of)::date - interval '8 weeks')
      group by week_start) q;
  elsif p_period = 'monthly' then
    select avg(t) into base from (
      select sum(value) t from public.ceo_kpi_meeting_entries
      where kpi_id = p_kpi_id and week_start < date_trunc('month', p_as_of)
        and week_start >= (date_trunc('month', p_as_of) - interval '3 months')
      group by date_trunc('month', week_start)) q;
  elsif p_period = 'quarterly' then
    select avg(t) into base from (
      select sum(value) t from public.ceo_kpi_meeting_entries
      where kpi_id = p_kpi_id and week_start < date_trunc('quarter', p_as_of)
        and week_start >= (date_trunc('quarter', p_as_of) - interval '4 quarters')
      group by date_trunc('quarter', week_start)) q;
  elsif p_period = 'yearly' then
    select sum(value) into base from public.ceo_kpi_meeting_entries
      where kpi_id = p_kpi_id and week_start >= (date_trunc('year', p_as_of) - interval '1 year')
        and week_start < date_trunc('year', p_as_of);
  else base := 0; end if;

  result := coalesce(base, 0) * coalesce(g.growth_factor, 1.10);
  if coalesce(g.ratchet_only, false) then
    select value into cur from public.ceo_kpi_meeting_goal_values where kpi_id = p_kpi_id and period = p_period order by period_start desc limit 1;
    result := greatest(result, coalesce(cur, 0));
  end if;
  return round(result, 2);
end; $$;

-- ── Materialize goal values for all active KPIs × periods (cron) ─────────────
create or replace function public.refresh_meeting_kpi_goals(p_as_of date default current_date)
returns int language plpgsql security definer set search_path = public as $$
declare d record; per text; ps date; v numeric; n int := 0;
begin
  for d in select id from public.ceo_kpi_meeting_definitions where is_active loop
    foreach per in array array['weekly','monthly','quarterly','yearly'] loop
      v := public.calc_meeting_kpi_goal(d.id, per, p_as_of);
      ps := case per
        when 'weekly' then date_trunc('week', p_as_of)::date
        when 'monthly' then date_trunc('month', p_as_of)::date
        when 'quarterly' then date_trunc('quarter', p_as_of)::date
        else date_trunc('year', p_as_of)::date end;
      insert into public.ceo_kpi_meeting_goal_values (kpi_id, period, period_start, value)
      values (d.id, per, ps, v)
      on conflict (kpi_id, period, period_start) do update set value = excluded.value;
      n := n + 1;
    end loop;
  end loop;
  return n;
end; $$;
grant execute on function public.calc_meeting_kpi_goal(uuid, text, date) to service_role;
grant execute on function public.refresh_meeting_kpi_goals(date) to service_role;

-- ── Roll-up views: current-period actual + latest materialized goal ─────────
create or replace view public.v_ceo_kpi_meeting_weekly as
select d.id as kpi_id, d.department_id, d.label, d.unit, date_trunc('week', current_date)::date as period_start,
  coalesce((select sum(value) from public.ceo_kpi_meeting_entries e where e.kpi_id = d.id and e.week_start = date_trunc('week', current_date)::date), 0) as actual,
  coalesce((select value from public.ceo_kpi_meeting_goal_values g where g.kpi_id = d.id and g.period = 'weekly' order by period_start desc limit 1), 0) as goal
from public.ceo_kpi_meeting_definitions d where d.is_active;

create or replace view public.v_ceo_kpi_meeting_monthly as
select d.id as kpi_id, d.department_id, d.label, d.unit, date_trunc('month', current_date)::date as period_start,
  coalesce((select sum(value) from public.ceo_kpi_meeting_entries e where e.kpi_id = d.id and e.week_start >= date_trunc('month', current_date) and e.week_start < (date_trunc('month', current_date) + interval '1 month')), 0) as actual,
  coalesce((select value from public.ceo_kpi_meeting_goal_values g where g.kpi_id = d.id and g.period = 'monthly' order by period_start desc limit 1), 0) as goal
from public.ceo_kpi_meeting_definitions d where d.is_active;

create or replace view public.v_ceo_kpi_meeting_quarterly as
select d.id as kpi_id, d.department_id, d.label, d.unit, date_trunc('quarter', current_date)::date as period_start,
  coalesce((select sum(value) from public.ceo_kpi_meeting_entries e where e.kpi_id = d.id and e.week_start >= date_trunc('quarter', current_date) and e.week_start < (date_trunc('quarter', current_date) + interval '3 months')), 0) as actual,
  coalesce((select value from public.ceo_kpi_meeting_goal_values g where g.kpi_id = d.id and g.period = 'quarterly' order by period_start desc limit 1), 0) as goal
from public.ceo_kpi_meeting_definitions d where d.is_active;

create or replace view public.v_ceo_kpi_meeting_ytd as
select d.id as kpi_id, d.department_id, d.label, d.unit, date_trunc('year', current_date)::date as period_start,
  coalesce((select sum(value) from public.ceo_kpi_meeting_entries e where e.kpi_id = d.id and e.week_start >= date_trunc('year', current_date)), 0) as actual,
  coalesce((select value from public.ceo_kpi_meeting_goal_values g where g.kpi_id = d.id and g.period = 'yearly' order by period_start desc limit 1), 0) as goal
from public.ceo_kpi_meeting_definitions d where d.is_active;
