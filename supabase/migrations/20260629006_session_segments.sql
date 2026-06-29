-- Migration: 20260629006_session_segments.sql
-- iCFO Events — Talk Show run-of-show. The host defines an ordered list of
-- segments (e.g. "Cold open", "The raise", "Hot seat", "Call-ins") and marks the
-- current one live. The public couch shows "Segment N of M · <title>" (Realtime).

do $$ begin create type segment_status as enum ('pending','live','done'); exception when duplicate_object then null; end $$;

create table if not exists public.session_segments (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  event_id   uuid not null references public.events(id) on delete cascade,
  title      text not null check (char_length(title) between 1 and 120),
  status     segment_status not null default 'pending',
  position   double precision not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists session_segments_session_idx on public.session_segments(session_id, position);
-- Full old row so clients can drop the right segment on DELETE.
alter table public.session_segments replica identity full;

alter table public.session_segments enable row level security;

-- staff: full control (host builds + drives the run-of-show).
drop policy if exists session_segments_staff_all on public.session_segments;
create policy session_segments_staff_all on public.session_segments
  for all using (public.is_staff()) with check (public.is_staff());

-- public: read the run-of-show for any visible event.
drop policy if exists session_segments_public_read on public.session_segments;
create policy session_segments_public_read on public.session_segments
  for select using (
    exists (select 1 from public.events e where e.id = event_id and e.status in ('published','live','ended'))
  );

alter publication supabase_realtime add table public.session_segments;
