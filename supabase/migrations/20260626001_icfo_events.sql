-- Migration: 20260626001_icfo_events.sql
-- iCFO Events — Phase 0 foundations: events, event_sectors, sessions, event_activity.
-- Ecosystem/community surface. NON-TRANSACTIONAL: no securities, no offers here.
-- Gated by existing public.is_staff() for all writes. Public can read published events only.
-- Phase 1+ tables (speaker_applications, registrations, sponsors, networking_*) come later.

-- ── enums (idempotent) ───────────────────────────────────────────────────────
do $$ begin create type event_status     as enum ('draft','published','live','ended','archived'); exception when duplicate_object then null; end $$;
do $$ begin create type event_format     as enum ('showcase','demo_day','webinar','hybrid');       exception when duplicate_object then null; end $$;
do $$ begin create type event_visibility as enum ('public','members');                             exception when duplicate_object then null; end $$;
do $$ begin create type session_type      as enum ('keynote','panel','talk_show','founder_showcase','workshop'); exception when duplicate_object then null; end $$;
do $$ begin create type session_status    as enum ('draft','scheduled','live','ended');            exception when duplicate_object then null; end $$;

-- ── events ───────────────────────────────────────────────────────────────────
create table if not exists public.events (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (char_length(title) between 1 and 200),
  slug        text not null unique check (char_length(slug) between 1 and 120),
  summary     text check (char_length(summary) <= 2000),
  status      event_status     not null default 'draft',
  format      event_format     not null default 'showcase',
  visibility  event_visibility not null default 'public',
  starts_at   timestamptz,
  ends_at     timestamptz,
  cover_path  text,
  created_by  uuid not null references public.profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  published_at timestamptz
);
create index if not exists events_status_idx     on public.events(status);
create index if not exists events_starts_at_idx   on public.events(starts_at);
create index if not exists events_created_by_idx   on public.events(created_by);

-- ── event_sectors (an event spans 1..N sector tracks) ────────────────────────
create table if not exists public.event_sectors (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.events(id) on delete cascade,
  sector_slug text not null check (char_length(sector_slug) between 1 and 80),
  label       text not null check (char_length(label) between 1 and 120),
  created_at  timestamptz not null default now(),
  unique (event_id, sector_slug)
);
create index if not exists event_sectors_event_idx on public.event_sectors(event_id);

-- ── sessions ─────────────────────────────────────────────────────────────────
create table if not exists public.sessions (
  id             uuid primary key default gen_random_uuid(),
  event_id       uuid not null references public.events(id) on delete cascade,
  sector_slug    text,
  title          text not null check (char_length(title) between 1 and 200),
  abstract       text check (char_length(abstract) <= 4000),
  type           session_type   not null default 'keynote',
  status         session_status not null default 'scheduled',
  starts_at      timestamptz,
  ends_at        timestamptz,
  video_provider text,
  video_ref      text,
  recording_path text,
  position       double precision not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists sessions_event_idx  on public.sessions(event_id);
create index if not exists sessions_sector_idx  on public.sessions(sector_slug);

-- ── event_activity (audit trail) ─────────────────────────────────────────────
create table if not exists public.event_activity (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.events(id) on delete cascade,
  actor_id   uuid references public.profiles(id) on delete set null,
  event_type text not null,
  payload    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists event_activity_event_idx on public.event_activity(event_id);

-- ── updated_at triggers (reuse shared touch_updated_at) ──────────────────────
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists events_touch on public.events;
create trigger events_touch before update on public.events
  for each row execute function public.touch_updated_at();

drop trigger if exists sessions_touch on public.sessions;
create trigger sessions_touch before update on public.sessions
  for each row execute function public.touch_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- Writes: staff only. Reads: staff see all; everyone sees published/live/ended
-- public events (members-only events require an authenticated session).
alter table public.events         enable row level security;
alter table public.event_sectors  enable row level security;
alter table public.sessions       enable row level security;
alter table public.event_activity enable row level security;

-- events
drop policy if exists events_staff_all on public.events;
create policy events_staff_all on public.events
  for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists events_public_read on public.events;
create policy events_public_read on public.events
  for select using (
    status in ('published','live','ended')
    and (visibility = 'public' or auth.uid() is not null)
  );

-- event_sectors (readable when the parent event is readable)
drop policy if exists event_sectors_staff_all on public.event_sectors;
create policy event_sectors_staff_all on public.event_sectors
  for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists event_sectors_public_read on public.event_sectors;
create policy event_sectors_public_read on public.event_sectors
  for select using (
    exists (
      select 1 from public.events e
      where e.id = event_id
        and e.status in ('published','live','ended')
        and (e.visibility = 'public' or auth.uid() is not null)
    )
  );

-- sessions (readable when parent event is readable; draft sessions stay staff-only)
drop policy if exists sessions_staff_all on public.sessions;
create policy sessions_staff_all on public.sessions
  for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists sessions_public_read on public.sessions;
create policy sessions_public_read on public.sessions
  for select using (
    status <> 'draft'
    and exists (
      select 1 from public.events e
      where e.id = event_id
        and e.status in ('published','live','ended')
        and (e.visibility = 'public' or auth.uid() is not null)
    )
  );

-- event_activity (staff only)
drop policy if exists event_activity_staff_all on public.event_activity;
create policy event_activity_staff_all on public.event_activity
  for all using (public.is_staff()) with check (public.is_staff());

-- ── RBAC: manage_events permission ───────────────────────────────────────────
insert into public.internal_permissions (slug, label, description)
values ('manage_events', 'Manage Events', 'Create, publish, and manage iCFO Events')
on conflict (slug) do nothing;

-- Grant to super_admin, admin, and manager (legacy admin/analyst get it via fallback).
insert into public.internal_role_permissions (role_id, permission_id, granted)
select r.id, p.id, true
from public.internal_roles r
join public.internal_permissions p on p.slug = 'manage_events'
where r.slug in ('super_admin','admin','manager')
on conflict do nothing;
