-- Migration: 20260626002_icfo_events_phase1.sql
-- iCFO Events — Phase 1: speaker_applications, event_presenters, registrations,
-- sponsors, event_sponsors, networking_optins. Plus private storage buckets for
-- recorded session video, sponsor logos, and presenter headshots.
-- Writes gated by public.is_staff(); applicants/attendees read+write their own rows.

-- ── enums (idempotent) ───────────────────────────────────────────────────────
do $$ begin create type speaker_application_kind   as enum ('presenter','panelist','founder_showcase'); exception when duplicate_object then null; end $$;
do $$ begin create type speaker_application_status as enum ('submitted','under_review','approved','declined'); exception when duplicate_object then null; end $$;
do $$ begin create type registration_status       as enum ('registered','attended','no_show'); exception when duplicate_object then null; end $$;
do $$ begin create type sponsor_tier              as enum ('presenting','gold','silver','community'); exception when duplicate_object then null; end $$;
do $$ begin create type sponsor_category          as enum ('legal','consulting','banking','other'); exception when duplicate_object then null; end $$;
do $$ begin create type event_sponsor_placement   as enum ('presenting','track','logo'); exception when duplicate_object then null; end $$;

-- ── speaker_applications ─────────────────────────────────────────────────────
create table if not exists public.speaker_applications (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references public.events(id) on delete cascade,
  applicant_id  uuid not null references public.profiles(id) on delete cascade,
  applicant_role text not null,
  kind          speaker_application_kind not null default 'presenter',
  topic         text not null check (char_length(topic) between 1 and 200),
  bio           text check (char_length(bio) <= 3000),
  sector_slug   text,
  links         jsonb not null default '[]'::jsonb,
  status        speaker_application_status not null default 'submitted',
  rubric_scores jsonb not null default '{}'::jsonb,
  reviewer_id   uuid references public.profiles(id) on delete set null,
  decision_note text,
  decided_at    timestamptz,
  created_at    timestamptz not null default now(),
  unique (event_id, applicant_id, kind)
);
create index if not exists speaker_apps_event_idx     on public.speaker_applications(event_id);
create index if not exists speaker_apps_applicant_idx  on public.speaker_applications(applicant_id);
create index if not exists speaker_apps_status_idx     on public.speaker_applications(status);

-- ── event_presenters (approved roster, shown publicly) ───────────────────────
create table if not exists public.event_presenters (
  id             uuid primary key default gen_random_uuid(),
  event_id       uuid not null references public.events(id) on delete cascade,
  session_id     uuid references public.sessions(id) on delete set null,
  application_id uuid references public.speaker_applications(id) on delete set null,
  profile_id     uuid references public.profiles(id) on delete set null,
  display_name   text not null,
  role_label     text,
  headshot_path  text,
  position       double precision not null default 0,
  created_at     timestamptz not null default now()
);
create index if not exists event_presenters_event_idx   on public.event_presenters(event_id);
create index if not exists event_presenters_session_idx  on public.event_presenters(session_id);

-- ── registrations (attendance signal; never exported raw) ────────────────────
create table if not exists public.registrations (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid not null references public.events(id) on delete cascade,
  attendee_id  uuid not null references public.profiles(id) on delete cascade,
  status       registration_status not null default 'registered',
  checked_in_at timestamptz,
  created_at   timestamptz not null default now(),
  unique (event_id, attendee_id)
);
create index if not exists registrations_event_idx    on public.registrations(event_id);
create index if not exists registrations_attendee_idx  on public.registrations(attendee_id);

-- ── sponsors (catalog) + event_sponsors (join) ──────────────────────────────
create table if not exists public.sponsors (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null check (char_length(name) between 1 and 160),
  logo_path          text,
  blurb              text check (char_length(blurb) <= 1000),
  website            text,
  tier               sponsor_tier not null default 'community',
  sector_slug        text,
  category           sponsor_category not null default 'other',
  category_exclusive boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table if not exists public.event_sponsors (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.events(id) on delete cascade,
  sponsor_id uuid not null references public.sponsors(id) on delete cascade,
  placement  event_sponsor_placement not null default 'logo',
  created_at timestamptz not null default now(),
  unique (event_id, sponsor_id)
);
create index if not exists event_sponsors_event_idx   on public.event_sponsors(event_id);
create index if not exists event_sponsors_sponsor_idx  on public.event_sponsors(sponsor_id);

-- ── networking_optins (opt-in only; default off) ─────────────────────────────
create table if not exists public.networking_optins (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.events(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  opted_in   boolean not null default false,
  interests  jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, profile_id)
);
create index if not exists networking_optins_event_idx on public.networking_optins(event_id);

-- ── updated_at triggers ──────────────────────────────────────────────────────
drop trigger if exists sponsors_touch on public.sponsors;
create trigger sponsors_touch before update on public.sponsors
  for each row execute function public.touch_updated_at();

drop trigger if exists networking_optins_touch on public.networking_optins;
create trigger networking_optins_touch before update on public.networking_optins
  for each row execute function public.touch_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.speaker_applications enable row level security;
alter table public.event_presenters     enable row level security;
alter table public.registrations        enable row level security;
alter table public.sponsors             enable row level security;
alter table public.event_sponsors       enable row level security;
alter table public.networking_optins    enable row level security;

-- speaker_applications: staff full; applicant inserts + reads their own.
drop policy if exists speaker_apps_staff_all on public.speaker_applications;
create policy speaker_apps_staff_all on public.speaker_applications
  for all using (public.is_staff()) with check (public.is_staff());
drop policy if exists speaker_apps_owner_insert on public.speaker_applications;
create policy speaker_apps_owner_insert on public.speaker_applications
  for insert with check (applicant_id = auth.uid());
drop policy if exists speaker_apps_owner_read on public.speaker_applications;
create policy speaker_apps_owner_read on public.speaker_applications
  for select using (applicant_id = auth.uid());

-- event_presenters: staff full; public read for published events.
drop policy if exists event_presenters_staff_all on public.event_presenters;
create policy event_presenters_staff_all on public.event_presenters
  for all using (public.is_staff()) with check (public.is_staff());
drop policy if exists event_presenters_public_read on public.event_presenters;
create policy event_presenters_public_read on public.event_presenters
  for select using (
    exists (
      select 1 from public.events e
      where e.id = event_id
        and e.status in ('published','live','ended')
        and (e.visibility = 'public' or auth.uid() is not null)
    )
  );

-- registrations: staff full; attendee inserts + reads their own.
drop policy if exists registrations_staff_all on public.registrations;
create policy registrations_staff_all on public.registrations
  for all using (public.is_staff()) with check (public.is_staff());
drop policy if exists registrations_owner_insert on public.registrations;
create policy registrations_owner_insert on public.registrations
  for insert with check (attendee_id = auth.uid());
drop policy if exists registrations_owner_read on public.registrations;
create policy registrations_owner_read on public.registrations
  for select using (attendee_id = auth.uid());

-- sponsors: staff full; public read (names/logos are public info).
drop policy if exists sponsors_staff_all on public.sponsors;
create policy sponsors_staff_all on public.sponsors
  for all using (public.is_staff()) with check (public.is_staff());
drop policy if exists sponsors_public_read on public.sponsors;
create policy sponsors_public_read on public.sponsors
  for select using (true);

-- event_sponsors: staff full; public read for published events.
drop policy if exists event_sponsors_staff_all on public.event_sponsors;
create policy event_sponsors_staff_all on public.event_sponsors
  for all using (public.is_staff()) with check (public.is_staff());
drop policy if exists event_sponsors_public_read on public.event_sponsors;
create policy event_sponsors_public_read on public.event_sponsors
  for select using (
    exists (
      select 1 from public.events e
      where e.id = event_id
        and e.status in ('published','live','ended')
        and (e.visibility = 'public' or auth.uid() is not null)
    )
  );

-- networking_optins: staff read; member manages their own row.
drop policy if exists networking_optins_staff_all on public.networking_optins;
create policy networking_optins_staff_all on public.networking_optins
  for all using (public.is_staff()) with check (public.is_staff());
drop policy if exists networking_optins_owner_all on public.networking_optins;
create policy networking_optins_owner_all on public.networking_optins
  for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- ── private storage buckets ──────────────────────────────────────────────────
insert into storage.buckets (id, name, public) values
  ('event-session-videos',    'event-session-videos',    false),
  ('event-sponsor-logos',     'event-sponsor-logos',     false),
  ('event-presenter-headshots','event-presenter-headshots', false)
on conflict (id) do nothing;

-- Staff manage all event media; everything is served via short-lived signed URLs.
drop policy if exists "event media staff all" on storage.objects;
create policy "event media staff all" on storage.objects
  for all using (
    bucket_id in ('event-session-videos','event-sponsor-logos','event-presenter-headshots')
    and public.is_staff()
  ) with check (
    bucket_id in ('event-session-videos','event-sponsor-logos','event-presenter-headshots')
    and public.is_staff()
  );
