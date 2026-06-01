-- Workflow automation execution audit (rules-based, Phase 1).
-- Rollback: drop table automation_actions, automation_runs.

create table if not exists public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  duration_ms int,
  trigger_type text,
  source_event_id text,
  entity_type text,
  entity_id text,
  actions_executed int not null default 0,
  actions_skipped int not null default 0,
  failures_count int not null default 0,
  dry_run boolean not null default false,
  status text not null default 'running',
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists automation_runs_started_idx
  on public.automation_runs (started_at desc);

create table if not exists public.automation_actions (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.automation_runs(id) on delete cascade,
  action_type text not null,
  status text not null default 'executed',
  target_entity_type text,
  target_entity_id text,
  message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists automation_actions_run_idx
  on public.automation_actions (run_id, created_at desc);

alter table public.automation_runs enable row level security;
alter table public.automation_actions enable row level security;

drop policy if exists "automation_runs_staff_select" on public.automation_runs;
create policy "automation_runs_staff_select"
  on public.automation_runs for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'analyst')
    )
  );

drop policy if exists "automation_actions_staff_select" on public.automation_actions;
create policy "automation_actions_staff_select"
  on public.automation_actions for select to authenticated
  using (
    exists (
      select 1 from public.automation_runs r
      join public.profiles p on p.id = auth.uid() and p.role in ('admin', 'analyst')
      where r.id = run_id
    )
  );
