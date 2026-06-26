-- Migration: 20260627003_callin_queue.sql
-- iCFO Events — Talk Show call-in queue. Attendees raise a hand; the host (staff)
-- invites them on, marks them on stage, then done. Coordination only — the actual
-- camera/mic promotion happens inside the embedded room.

do $$ begin create type callin_status as enum ('requested','invited','onstage','done'); exception when duplicate_object then null; end $$;

create table if not exists public.session_callin_queue (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  event_id   uuid not null references public.events(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  status     callin_status not null default 'requested',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, profile_id)
);
create index if not exists callin_session_idx on public.session_callin_queue(session_id, created_at);
-- DELETE (withdraw) needs full old row so the host's client can drop the right entry.
alter table public.session_callin_queue replica identity full;

drop trigger if exists callin_touch on public.session_callin_queue;
create trigger callin_touch before update on public.session_callin_queue
  for each row execute function public.touch_updated_at();

alter table public.session_callin_queue enable row level security;

-- staff: full (host manages the queue).
drop policy if exists callin_staff_all on public.session_callin_queue;
create policy callin_staff_all on public.session_callin_queue
  for all using (public.is_staff()) with check (public.is_staff());

-- attendee: read + raise + withdraw their own hand.
drop policy if exists callin_owner_read on public.session_callin_queue;
create policy callin_owner_read on public.session_callin_queue
  for select using (profile_id = auth.uid());
drop policy if exists callin_owner_insert on public.session_callin_queue;
create policy callin_owner_insert on public.session_callin_queue
  for insert with check (profile_id = auth.uid() and status = 'requested');
drop policy if exists callin_owner_delete on public.session_callin_queue;
create policy callin_owner_delete on public.session_callin_queue
  for delete using (profile_id = auth.uid());

alter publication supabase_realtime add table public.session_callin_queue;
