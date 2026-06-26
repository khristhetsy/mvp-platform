-- Migration: 20260626005_icfo_events_points.sql
-- iCFO Events — Phase 3: gamification ledger. Points reward real participation;
-- rewards are STATUS (badges, leaderboard rank), never prizes or money.
-- Idempotent per (event, member, action, ref) so an action is scored once.

create table if not exists public.event_points (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.events(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  action     text not null,
  ref        text not null default '',
  points     integer not null default 0,
  created_at timestamptz not null default now(),
  unique (event_id, profile_id, action, ref)
);
create index if not exists event_points_event_idx   on public.event_points(event_id);
create index if not exists event_points_profile_idx on public.event_points(profile_id);

alter table public.event_points enable row level security;

-- staff: full. Awards are written server-side via the service role.
drop policy if exists event_points_staff_all on public.event_points;
create policy event_points_staff_all on public.event_points
  for all using (public.is_staff()) with check (public.is_staff());

-- members can read their own points (the leaderboard itself is computed
-- server-side via the service role and exposes only names + totals).
drop policy if exists event_points_owner_read on public.event_points;
create policy event_points_owner_read on public.event_points
  for select using (profile_id = auth.uid());
