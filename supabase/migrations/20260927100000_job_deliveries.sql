-- What each scheduled job sent: one row per email or in-app message delivered
-- while a job was running (Admin, System, Scheduled jobs, a job's Sent tab).
-- Written by the email sender and the notification writer with the service
-- role; rows older than 30 days are removed as new ones arrive. Staff read it
-- through the admin API, so RLS is on with no policies.

create table if not exists public.job_deliveries (
  id                 bigserial primary key,
  job                text not null,
  run_id             bigint,
  channel            text not null check (channel in ('email', 'in_app')),
  recipient_user_id  uuid references public.profiles(id) on delete set null,
  to_email           text,
  subject            text not null,
  body_html          text,
  message            text,
  status             text not null check (status in ('sent', 'failed', 'skipped')),
  error              text,
  created_at         timestamptz not null default now()
);

create index if not exists job_deliveries_job_created_idx on public.job_deliveries (job, created_at desc);
create index if not exists job_deliveries_recipient_idx on public.job_deliveries (recipient_user_id);

alter table public.job_deliveries enable row level security;
