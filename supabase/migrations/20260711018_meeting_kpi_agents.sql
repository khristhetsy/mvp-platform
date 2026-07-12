-- Weekly Meeting System — KPI per-agent grid.
-- Upgrades the KPI "Data Input" from a single value-per-week to the real workbook shape:
-- each KPI has a roster of agents, and each agent carries a weekly GOAL + ACTUAL
-- (owed = goal − actual, computed in the UI). Agents are a lightweight roster (name only)
-- so team members who aren't platform logins can still be tracked. is_staff() RLS throughout.

-- ── Agent roster (per department) ───────────────────────────────────────────────
create table if not exists public.ceo_kpi_meeting_agents (
  id            uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete cascade,
  name          text not null,
  position      int not null default 0,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  unique (department_id, name)
);
alter table public.ceo_kpi_meeting_agents enable row level security;
drop policy if exists ceo_kpi_meeting_agents_staff on public.ceo_kpi_meeting_agents;
create policy ceo_kpi_meeting_agents_staff on public.ceo_kpi_meeting_agents for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- ── Per-agent weekly goal + actual ──────────────────────────────────────────────
create table if not exists public.ceo_kpi_meeting_agent_entries (
  id           uuid primary key default gen_random_uuid(),
  kpi_id       uuid not null references public.ceo_kpi_meeting_definitions(id) on delete cascade,
  agent_id     uuid not null references public.ceo_kpi_meeting_agents(id) on delete cascade,
  week_start   date not null,                           -- Monday
  goal_value   numeric,
  actual_value numeric,
  entered_by   uuid references public.profiles(id),
  updated_at   timestamptz not null default now(),
  unique (kpi_id, agent_id, week_start)
);
create index if not exists ceo_kpi_meeting_agent_entries_kpi_idx on public.ceo_kpi_meeting_agent_entries (kpi_id, week_start);
alter table public.ceo_kpi_meeting_agent_entries enable row level security;
drop policy if exists ceo_kpi_meeting_agent_entries_staff on public.ceo_kpi_meeting_agent_entries;
create policy ceo_kpi_meeting_agent_entries_staff on public.ceo_kpi_meeting_agent_entries for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- ── Roll-up views now aggregate the per-agent grid (actual = Σ actual, goal = Σ goal) ─
create or replace view public.v_ceo_kpi_meeting_weekly as
select d.id as kpi_id, d.department_id, d.label, d.unit, date_trunc('week', current_date)::date as period_start,
  coalesce((select sum(actual_value) from public.ceo_kpi_meeting_agent_entries e where e.kpi_id = d.id and e.week_start = date_trunc('week', current_date)::date), 0) as actual,
  coalesce((select sum(goal_value)   from public.ceo_kpi_meeting_agent_entries e where e.kpi_id = d.id and e.week_start = date_trunc('week', current_date)::date), 0) as goal
from public.ceo_kpi_meeting_definitions d where d.is_active;

create or replace view public.v_ceo_kpi_meeting_monthly as
select d.id as kpi_id, d.department_id, d.label, d.unit, date_trunc('month', current_date)::date as period_start,
  coalesce((select sum(actual_value) from public.ceo_kpi_meeting_agent_entries e where e.kpi_id = d.id and e.week_start >= date_trunc('month', current_date) and e.week_start < (date_trunc('month', current_date) + interval '1 month')), 0) as actual,
  coalesce((select sum(goal_value)   from public.ceo_kpi_meeting_agent_entries e where e.kpi_id = d.id and e.week_start >= date_trunc('month', current_date) and e.week_start < (date_trunc('month', current_date) + interval '1 month')), 0) as goal
from public.ceo_kpi_meeting_definitions d where d.is_active;

create or replace view public.v_ceo_kpi_meeting_quarterly as
select d.id as kpi_id, d.department_id, d.label, d.unit, date_trunc('quarter', current_date)::date as period_start,
  coalesce((select sum(actual_value) from public.ceo_kpi_meeting_agent_entries e where e.kpi_id = d.id and e.week_start >= date_trunc('quarter', current_date) and e.week_start < (date_trunc('quarter', current_date) + interval '3 months')), 0) as actual,
  coalesce((select sum(goal_value)   from public.ceo_kpi_meeting_agent_entries e where e.kpi_id = d.id and e.week_start >= date_trunc('quarter', current_date) and e.week_start < (date_trunc('quarter', current_date) + interval '3 months')), 0) as goal
from public.ceo_kpi_meeting_definitions d where d.is_active;

create or replace view public.v_ceo_kpi_meeting_ytd as
select d.id as kpi_id, d.department_id, d.label, d.unit, date_trunc('year', current_date)::date as period_start,
  coalesce((select sum(actual_value) from public.ceo_kpi_meeting_agent_entries e where e.kpi_id = d.id and e.week_start >= date_trunc('year', current_date)), 0) as actual,
  coalesce((select sum(goal_value)   from public.ceo_kpi_meeting_agent_entries e where e.kpi_id = d.id and e.week_start >= date_trunc('year', current_date)), 0) as goal
from public.ceo_kpi_meeting_definitions d where d.is_active;

-- ── Seed: Marketing agents + KPIs + goals across recent weeks (from the iCFO workbook) ─
insert into public.ceo_kpi_meeting_agents (department_id, name, position)
select d.id, a.name, a.pos
from (select id from public.departments where key = 'marketing') d,
     (values ('Khris Thetsy',1),('Jack Cohen',2),('Bruce Blechman',3),('Pedro de Leon Jr',4),
             ('Jessica Santos',5),('Robert Ruiz',6),('Steven Lee',7),('Michael Lerma',8),
             ('George Mena',9),('Phillip Bradley',10),('Amanda Bar',11),('Bob Lucas',12)) a(name,pos)
on conflict (department_id, name) do nothing;

insert into public.ceo_kpi_meeting_definitions (department_id, key, label, unit, position)
select d.id, k.key, k.label, 'count', k.pos
from (select id from public.departments where key = 'marketing') d,
     (values ('connection_requests','Connection Requests on LinkedIn',1),
             ('sales_meetings_per_partner','Sales Meetings per Partner',2),
             ('meetings_with_investors','Meetings with Investors',3)) k(key,label,pos)
on conflict (department_id, key) do nothing;

-- Per-agent standing goals across the 8 recent Mondays (matches the UI's recentMondays(8)).
-- Current-week actuals seeded from the workbook's Week-1 column; other weeks left blank to fill in.
insert into public.ceo_kpi_meeting_agent_entries (kpi_id, agent_id, week_start, goal_value, actual_value)
select def.id, ag.id, m.wk, s.goal::numeric,
       case when m.wk = date_trunc('week', current_date)::date then s.wk1::numeric else null end
from (values
  ('connection_requests','Khris Thetsy',125,145),
  ('connection_requests','Jack Cohen',125,130),
  ('connection_requests','Bruce Blechman',125,116),
  ('connection_requests','Pedro de Leon Jr',125,null),
  ('connection_requests','Jessica Santos',100,27),
  ('connection_requests','Robert Ruiz',100,25),
  ('connection_requests','Steven Lee',100,70),
  ('connection_requests','Michael Lerma',100,110),
  ('connection_requests','George Mena',100,140),
  ('sales_meetings_per_partner','Khris Thetsy',10,14),
  ('sales_meetings_per_partner','Jack Cohen',10,5),
  ('sales_meetings_per_partner','Phillip Bradley',10,4),
  ('sales_meetings_per_partner','Amanda Bar',10,null),
  ('sales_meetings_per_partner','Pedro de Leon Jr',10,null),
  ('sales_meetings_per_partner','Steven Lee',10,1),
  ('sales_meetings_per_partner','Michael Lerma',10,null),
  ('sales_meetings_per_partner','George Mena',10,6),
  ('sales_meetings_per_partner','Bob Lucas',10,null),
  ('meetings_with_investors','Jessica Santos',5,null)
) s(kpi_key, agent_name, goal, wk1)
join (select id from public.departments where key = 'marketing') d on true
join public.ceo_kpi_meeting_definitions def on def.department_id = d.id and def.key = s.kpi_key
join public.ceo_kpi_meeting_agents ag on ag.department_id = d.id and ag.name = s.agent_name
cross join (
  select generate_series(date_trunc('week', current_date) - interval '7 weeks',
                         date_trunc('week', current_date), interval '1 week')::date as wk
) m
on conflict (kpi_id, agent_id, week_start) do nothing;
