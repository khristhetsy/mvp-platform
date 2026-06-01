-- Scheduled digest runs (in-app, Phase 1). Email delivery optional later.
-- Rollback: drop table scheduled_digest_items, scheduled_digest_runs.

create table if not exists public.scheduled_digest_runs (
  id uuid primary key default gen_random_uuid(),
  digest_type text not null,
  user_id uuid references public.profiles(id) on delete cascade,
  generated_at timestamptz not null default now(),
  item_count int not null default 0,
  severity text not null default 'info',
  delivery_status text not null default 'delivered',
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists scheduled_digest_runs_type_idx
  on public.scheduled_digest_runs (digest_type, generated_at desc);

create index if not exists scheduled_digest_runs_user_idx
  on public.scheduled_digest_runs (user_id, generated_at desc)
  where user_id is not null;

create table if not exists public.scheduled_digest_items (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.scheduled_digest_runs(id) on delete cascade,
  section text not null,
  title text not null,
  severity text not null default 'info',
  deep_link text,
  action_id uuid references public.next_best_actions(id) on delete set null,
  sort_order int not null default 0
);

create index if not exists scheduled_digest_items_run_idx
  on public.scheduled_digest_items (run_id, sort_order);

alter table public.scheduled_digest_runs enable row level security;
alter table public.scheduled_digest_items enable row level security;

drop policy if exists "scheduled_digest_runs_select_own" on public.scheduled_digest_runs;
create policy "scheduled_digest_runs_select_own"
  on public.scheduled_digest_runs for select to authenticated
  using (user_id is null or user_id = auth.uid());

drop policy if exists "scheduled_digest_items_select_own" on public.scheduled_digest_items;
create policy "scheduled_digest_items_select_own"
  on public.scheduled_digest_items for select to authenticated
  using (
    exists (
      select 1 from public.scheduled_digest_runs r
      where r.id = run_id and (r.user_id is null or r.user_id = auth.uid())
    )
  );
