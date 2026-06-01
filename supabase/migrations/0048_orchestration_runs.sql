-- Cron / manual orchestration execution audit log.
-- Rollback: drop table public.orchestration_runs;

create table if not exists public.orchestration_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  duration_ms int,
  reminders_generated int not null default 0,
  digests_generated int not null default 0,
  escalations_detected int not null default 0,
  overdue_detected int not null default 0,
  failures_count int not null default 0,
  status text not null default 'running',
  trigger_source text not null default 'cron',
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists orchestration_runs_started_idx
  on public.orchestration_runs (started_at desc);

alter table public.orchestration_runs enable row level security;

drop policy if exists "orchestration_runs_staff_select" on public.orchestration_runs;
create policy "orchestration_runs_staff_select"
  on public.orchestration_runs for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'analyst')
    )
  );
