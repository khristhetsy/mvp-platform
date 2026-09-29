-- Run log for scheduled jobs: Admin, System, Scheduled jobs shows each job's
-- last result from here. Written by the cron gate with the service role (which
-- bypasses RLS); rows older than 14 days are deleted by the gate after each run
-- of that job.
create table if not exists public.cron_runs (
  id           bigserial primary key,
  job          text not null,
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  status       text not null check (status in ('running', 'ok', 'error', 'skipped')),
  http_status  integer,
  duration_ms  integer,
  detail       text
);

create index if not exists cron_runs_job_started_idx on public.cron_runs (job, started_at desc);

alter table public.cron_runs enable row level security;

-- Staff may read the log. No one writes through the API: inserts, updates and
-- deletes come only from the service role.
drop policy if exists cron_runs_staff_read on public.cron_runs;
create policy cron_runs_staff_read on public.cron_runs
  for select to authenticated
  using (public.is_staff());
