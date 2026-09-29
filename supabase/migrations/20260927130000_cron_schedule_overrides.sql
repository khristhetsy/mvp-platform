-- Schedule changes made on Admin > System > Scheduled jobs.
-- One row per job that no longer follows its default vercel.json schedule.
-- cron: the custom repeating schedule, in Paris time (several expressions joined
-- by "; "); null keeps the default. next_run_at: a one-off run at a set time,
-- cleared once it has run. Read and written by the admin API and the job
-- dispatcher with the service role, so RLS is on with no policies.

create table if not exists public.cron_schedule_overrides (
  job               text primary key,
  cron              text,
  next_run_at       timestamptz,
  last_dispatch_at  timestamptz,
  updated_by        uuid references public.profiles(id) on delete set null,
  updated_at        timestamptz not null default now(),
  check (cron is not null or next_run_at is not null)
);

alter table public.cron_schedule_overrides enable row level security;
