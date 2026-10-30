-- Database health monitoring (Admin, System health, Database health).
--
-- A check runs every 5 minutes (/api/cron/db-health). Each run stores one
-- sample, and a run of bad samples opens an incident that admins are told about.
--
--   db_health_samples    one row per check: response time, connections, the
--                        longest running query, cron timeouts
--   db_health_incidents  one row per slowdown: when it started and ended,
--                        the likely cause, what was done
--   db_health_snapshot() reads pg_stat_activity for the check. Service role only.
--
-- Alert limits are not stored here. They live in platform_settings under the
-- key "db_health_settings" and fall back to defaults in code.
--
-- Roles: staff may read both tables. Nobody writes through the API, the check
-- writes with the service role, which bypasses RLS.

create table if not exists public.db_health_samples (
  id                 bigserial primary key,
  taken_at           timestamptz not null default now(),
  -- Time for a simple test query through the API, in milliseconds. Null when the test failed.
  response_ms        integer,
  probe_error        text,
  active_connections integer,
  -- Longest query running at the moment of the check, in seconds, with its first 200 characters.
  longest_query_s    numeric(10, 1),
  longest_query_text text,
  -- Scheduled jobs newly found, at this check, to have started and never finished.
  -- Add the rows of the last 24 hours for the 24 hour total.
  cron_timeouts      integer not null default 0,
  state              text not null check (state in ('ok', 'warn', 'overload'))
);

create index if not exists db_health_samples_taken_idx on public.db_health_samples (taken_at desc);

create table if not exists public.db_health_incidents (
  id               bigserial primary key,
  started_at       timestamptz not null default now(),
  ended_at         timestamptz,
  peak_state       text not null check (peak_state in ('warn', 'overload')),
  -- jobs_and_queries | job_timeout | slow_query | slow_response
  cause            text not null,
  peak_response_ms integer,
  peak_query_s     numeric(10, 1),
  cron_timeouts    integer not null default 0,
  notified_at      timestamptz,
  action_taken     text
);

create index if not exists db_health_incidents_started_idx on public.db_health_incidents (started_at desc);
-- At most one open incident at a time.
create unique index if not exists db_health_incidents_one_open_idx
  on public.db_health_incidents ((ended_at is null)) where ended_at is null;

alter table public.db_health_samples enable row level security;
alter table public.db_health_incidents enable row level security;

drop policy if exists db_health_samples_staff_read on public.db_health_samples;
create policy db_health_samples_staff_read on public.db_health_samples
  for select to authenticated
  using (public.is_staff());

drop policy if exists db_health_incidents_staff_read on public.db_health_incidents;
create policy db_health_incidents_staff_read on public.db_health_incidents
  for select to authenticated
  using (public.is_staff());

-- Connections and the longest running query, for the check. Excludes the
-- caller's own connection and idle connections.
create or replace function public.db_health_snapshot()
returns jsonb
language sql
security definer
set search_path = pg_catalog, public
as $$
  with active as (
    select
      pid,
      extract(epoch from (now() - query_start)) as secs,
      left(regexp_replace(query, '\s+', ' ', 'g'), 200) as q
    from pg_stat_activity
    where datname = current_database()
      and pid <> pg_backend_pid()
      and state = 'active'
      and backend_type = 'client backend'
  )
  select jsonb_build_object(
    'active_connections', (
      select count(*) from pg_stat_activity
      where datname = current_database() and pid <> pg_backend_pid() and backend_type = 'client backend'
    ),
    'longest_query_s', (select round(max(secs)::numeric, 1) from active),
    'longest_query_text', (select q from active order by secs desc limit 1)
  );
$$;

revoke all on function public.db_health_snapshot() from public, anon, authenticated;
grant execute on function public.db_health_snapshot() to service_role;
