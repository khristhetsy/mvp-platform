-- Migration: 20260627001_event_lounge.sql
-- iCFO Events — Networking Lounge: topic tables + ambient chat. Live presence is
-- ephemeral (Realtime presence channel, no table). Education/community only.

create table if not exists public.lounge_tables (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.events(id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 120),
  topic       text check (char_length(topic) <= 280),
  sector_slug text,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists lounge_tables_event_idx on public.lounge_tables(event_id);

create table if not exists public.lounge_messages (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.events(id) on delete cascade,
  table_id   uuid not null references public.lounge_tables(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists lounge_messages_table_idx on public.lounge_messages(table_id, created_at);

alter table public.lounge_tables   enable row level security;
alter table public.lounge_messages enable row level security;

-- Helper predicate: the event is published (so the lounge is open).
-- Inlined per policy to avoid a new function.

-- lounge_tables: staff full; authenticated members read + create for published events.
drop policy if exists lounge_tables_staff_all on public.lounge_tables;
create policy lounge_tables_staff_all on public.lounge_tables
  for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists lounge_tables_member_read on public.lounge_tables;
create policy lounge_tables_member_read on public.lounge_tables
  for select using (
    auth.uid() is not null
    and exists (select 1 from public.events e where e.id = event_id and e.status in ('published','live'))
  );

drop policy if exists lounge_tables_member_insert on public.lounge_tables;
create policy lounge_tables_member_insert on public.lounge_tables
  for insert with check (
    created_by = auth.uid()
    and exists (select 1 from public.events e where e.id = event_id and e.status in ('published','live'))
  );

-- lounge_messages: staff full; members read for published events; post as themselves.
drop policy if exists lounge_messages_staff_all on public.lounge_messages;
create policy lounge_messages_staff_all on public.lounge_messages
  for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists lounge_messages_member_read on public.lounge_messages;
create policy lounge_messages_member_read on public.lounge_messages
  for select using (
    auth.uid() is not null
    and exists (select 1 from public.events e where e.id = event_id and e.status in ('published','live'))
  );

drop policy if exists lounge_messages_member_insert on public.lounge_messages;
create policy lounge_messages_member_insert on public.lounge_messages
  for insert with check (profile_id = auth.uid());

-- Realtime: stream new tables + messages to subscribers.
alter publication supabase_realtime add table public.lounge_tables;
alter publication supabase_realtime add table public.lounge_messages;
