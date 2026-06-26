-- Migration: 20260627006_session_guests.sql
-- iCFO Events — Talk Show guest roster. The host pre-loads named guests and swaps
-- who's on stage live. Public sees the current on-stage guests (Realtime).

do $$ begin create type guest_status as enum ('backstage','onstage'); exception when duplicate_object then null; end $$;

create table if not exists public.session_guests (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references public.sessions(id) on delete cascade,
  event_id     uuid not null references public.events(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 120),
  role_label   text,
  status       guest_status not null default 'backstage',
  position     double precision not null default 0,
  profile_id   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists session_guests_session_idx on public.session_guests(session_id);
alter table public.session_guests replica identity full;

alter table public.session_guests enable row level security;

drop policy if exists session_guests_staff_all on public.session_guests;
create policy session_guests_staff_all on public.session_guests
  for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists session_guests_public_read on public.session_guests;
create policy session_guests_public_read on public.session_guests
  for select using (
    exists (select 1 from public.events e where e.id = event_id and e.status in ('published','live','ended'))
  );

alter publication supabase_realtime add table public.session_guests;
