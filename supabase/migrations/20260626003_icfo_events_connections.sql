-- Migration: 20260626003_icfo_events_connections.sql
-- iCFO Events — Phase 3: double opt-in networking connection handshake.
-- A member requests a connection with another attendee; the recipient accepts or
-- declines. Names only — no raw contact data. Both parties can see their own rows.

do $$ begin create type networking_connection_status as enum ('requested','accepted','declined'); exception when duplicate_object then null; end $$;

create table if not exists public.networking_connections (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid not null references public.events(id) on delete cascade,
  from_id      uuid not null references public.profiles(id) on delete cascade,
  to_id        uuid not null references public.profiles(id) on delete cascade,
  status       networking_connection_status not null default 'requested',
  created_at   timestamptz not null default now(),
  responded_at timestamptz,
  unique (event_id, from_id, to_id),
  check (from_id <> to_id)
);
create index if not exists networking_connections_event_idx on public.networking_connections(event_id);
create index if not exists networking_connections_from_idx  on public.networking_connections(from_id);
create index if not exists networking_connections_to_idx    on public.networking_connections(to_id);

alter table public.networking_connections enable row level security;

-- staff: full
drop policy if exists networking_connections_staff_all on public.networking_connections;
create policy networking_connections_staff_all on public.networking_connections
  for all using (public.is_staff()) with check (public.is_staff());

-- either party can read their own rows
drop policy if exists networking_connections_party_read on public.networking_connections;
create policy networking_connections_party_read on public.networking_connections
  for select using (from_id = auth.uid() or to_id = auth.uid());

-- requester can create a request as themselves
drop policy if exists networking_connections_from_insert on public.networking_connections;
create policy networking_connections_from_insert on public.networking_connections
  for insert with check (from_id = auth.uid());

-- recipient can respond (accept/decline) to a request addressed to them
drop policy if exists networking_connections_to_update on public.networking_connections;
create policy networking_connections_to_update on public.networking_connections
  for update using (to_id = auth.uid()) with check (to_id = auth.uid());
