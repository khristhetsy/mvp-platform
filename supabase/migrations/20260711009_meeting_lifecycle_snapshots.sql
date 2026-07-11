-- Weekly Meeting System — meeting-integrity core (spec §4 start_meeting/close_meeting,
-- §2.1 meeting_kpi_snapshots). Also fixes a latent gap: the board reads started_at from
-- ceo_meeting_sessions but no prior migration added it. Adds started_at/ended_at/status,
-- a snapshot table (KPI values frozen into JSONB at meeting start — "what was true when
-- discussed"), and a readiness-miss log written on close.

alter table public.ceo_meeting_sessions add column if not exists started_at timestamptz;
alter table public.ceo_meeting_sessions add column if not exists ended_at timestamptz;
alter table public.ceo_meeting_sessions add column if not exists status text not null default 'scheduled';

do $$
begin
  if not exists (
    select 1 from information_schema.constraint_column_usage
    where table_name = 'ceo_meeting_sessions' and constraint_name = 'ceo_meeting_sessions_status_check'
  ) then
    alter table public.ceo_meeting_sessions
      add constraint ceo_meeting_sessions_status_check
      check (status in ('scheduled','live','closed','summarized'));
  end if;
end $$;

-- KPI (and analytics) values frozen at meeting start.
create table if not exists public.ceo_meeting_kpi_snapshots (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references public.ceo_meeting_sessions(id) on delete cascade,
  source        text not null,                         -- e.g. 'kpi_weekly'
  department_id uuid references public.departments(id) on delete set null,
  payload       jsonb not null,
  captured_at   timestamptz not null default now()
);
create index if not exists ceo_meeting_kpi_snapshots_session_idx
  on public.ceo_meeting_kpi_snapshots (session_id, source);

-- Required sections that were not ready/presented when the meeting closed.
create table if not exists public.ceo_meeting_readiness_log (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references public.ceo_meeting_sessions(id) on delete cascade,
  section_id    uuid references public.ceo_meeting_sections(id) on delete set null,
  department_id uuid references public.departments(id) on delete set null,
  status        text,
  captured_at   timestamptz not null default now()
);
create index if not exists ceo_meeting_readiness_log_session_idx
  on public.ceo_meeting_readiness_log (session_id);

alter table public.ceo_meeting_kpi_snapshots enable row level security;
alter table public.ceo_meeting_readiness_log enable row level security;

drop policy if exists ceo_meeting_kpi_snapshots_staff on public.ceo_meeting_kpi_snapshots;
create policy ceo_meeting_kpi_snapshots_staff on public.ceo_meeting_kpi_snapshots
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists ceo_meeting_readiness_log_staff on public.ceo_meeting_readiness_log;
create policy ceo_meeting_readiness_log_staff on public.ceo_meeting_readiness_log
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

grant select, insert, update, delete on public.ceo_meeting_kpi_snapshots to service_role;
grant select, insert, update, delete on public.ceo_meeting_readiness_log to service_role;
