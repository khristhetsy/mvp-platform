-- Event nudge dismissals: a founder closes the "upcoming event" nudge for one
-- event and it stays closed for that event, on every device.
-- Additive and idempotent. Apply on staging, verify, then production.
--
-- Access: each signed-in user reads, adds and removes only their own rows.
-- Staff get no access through these policies; the service role bypasses RLS.

create table if not exists public.event_nudge_dismissals (
  user_id      uuid not null references public.profiles(id) on delete cascade,
  event_id     uuid not null references public.events(id) on delete cascade,
  dismissed_at timestamptz not null default now(),
  primary key (user_id, event_id)
);

alter table public.event_nudge_dismissals enable row level security;

drop policy if exists event_nudge_dismissals_select_own on public.event_nudge_dismissals;
create policy event_nudge_dismissals_select_own
  on public.event_nudge_dismissals for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists event_nudge_dismissals_insert_own on public.event_nudge_dismissals;
create policy event_nudge_dismissals_insert_own
  on public.event_nudge_dismissals for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists event_nudge_dismissals_update_own on public.event_nudge_dismissals;
create policy event_nudge_dismissals_update_own
  on public.event_nudge_dismissals for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists event_nudge_dismissals_delete_own on public.event_nudge_dismissals;
create policy event_nudge_dismissals_delete_own
  on public.event_nudge_dismissals for delete
  to authenticated
  using (user_id = auth.uid());

-- Deleting an event cascades here; this keeps that from scanning the table.
create index if not exists event_nudge_dismissals_event_id_idx
  on public.event_nudge_dismissals (event_id);

-- Rollback: drop table if exists public.event_nudge_dismissals;
