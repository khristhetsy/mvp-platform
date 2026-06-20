-- Calendar + scheduler (Phase 1). Additive.
--
-- calendar_events is our OWN authoritative event store (synced to Google for
-- connected users via external_provider/external_event_id). scheduling_availability
-- holds each user's bookable hours so we can compute open slots from Google
-- free/busy + local events. Both are owner-scoped via RLS; the booking flow reads
-- a host's availability through the service-role client on the server.

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  start_time timestamptz not null,
  end_time timestamptz not null,
  timezone text not null default 'UTC',
  all_day boolean not null default false,
  location text,
  attendees jsonb not null default '[]'::jsonb,
  meet_url text,
  source text not null default 'capitalos' check (source in ('capitalos', 'google')),
  external_provider text,
  external_event_id text,
  status text not null default 'confirmed' check (status in ('confirmed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists calendar_events_owner_idx on public.calendar_events (owner_id);
create index if not exists calendar_events_start_idx on public.calendar_events (start_time);
create index if not exists calendar_events_owner_start_idx on public.calendar_events (owner_id, start_time);

create table if not exists public.scheduling_availability (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  timezone text not null default 'UTC',
  slot_minutes int not null default 30 check (slot_minutes between 5 and 480),
  buffer_minutes int not null default 0 check (buffer_minutes between 0 and 240),
  -- weekly_rules: [{ "weekday": 0-6, "startMinute": 0-1439, "endMinute": 1-1440 }]
  weekly_rules jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.calendar_events enable row level security;
alter table public.scheduling_availability enable row level security;

-- calendar_events: owner-only
drop policy if exists "calendar_events_select_own" on public.calendar_events;
create policy "calendar_events_select_own"
  on public.calendar_events for select
  using (owner_id = auth.uid());

drop policy if exists "calendar_events_insert_own" on public.calendar_events;
create policy "calendar_events_insert_own"
  on public.calendar_events for insert
  with check (owner_id = auth.uid());

drop policy if exists "calendar_events_update_own" on public.calendar_events;
create policy "calendar_events_update_own"
  on public.calendar_events for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "calendar_events_delete_own" on public.calendar_events;
create policy "calendar_events_delete_own"
  on public.calendar_events for delete
  using (owner_id = auth.uid());

-- scheduling_availability: owner-only
drop policy if exists "scheduling_availability_select_own" on public.scheduling_availability;
create policy "scheduling_availability_select_own"
  on public.scheduling_availability for select
  using (profile_id = auth.uid());

drop policy if exists "scheduling_availability_insert_own" on public.scheduling_availability;
create policy "scheduling_availability_insert_own"
  on public.scheduling_availability for insert
  with check (profile_id = auth.uid());

drop policy if exists "scheduling_availability_update_own" on public.scheduling_availability;
create policy "scheduling_availability_update_own"
  on public.scheduling_availability for update
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());
