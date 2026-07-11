-- Weekly Management Meeting System — Step 1 (Foundation).
-- EXTENDS the existing CEO Hub Meeting Log (ceo_meetings → ceo_meeting_sessions).
-- Adds a multi-department agenda layer: ordered sections per meeting, per-session
-- section entries (journals) with version history, per-person attendance, and a
-- reminder log. RLS is is_staff() (matching the ceo_* convention); department-scope
-- and the pre-start journal write-lock are enforced in the API layer.

-- ── Missing department: Sales Support (SOS) ──────────────────────────────────
insert into public.departments (key, name, hub_key, is_admin, is_active)
select 'sos', 'Sales Support', 'sos', false, true
where not exists (select 1 from public.departments where key = 'sos');

-- ── Agenda sections (registry, per meeting_key) ──────────────────────────────
create table if not exists public.ceo_meeting_sections (
  id                   uuid primary key default gen_random_uuid(),
  meeting_key          text not null references public.ceo_meetings(key) on delete cascade,
  position             int not null,
  title                text not null,
  department_id        uuid references public.departments(id),
  section_kind         text not null default 'department' check (section_kind in ('department','carryover','action_items','overview')),
  default_presenter_id uuid references public.profiles(id),
  kpi_view             text,
  is_required          boolean not null default true,
  pinned               text check (pinned in ('first','last')),
  created_at           timestamptz not null default now(),
  unique (meeting_key, position)
);
alter table public.ceo_meeting_sections enable row level security;
drop policy if exists ceo_meeting_sections_staff on public.ceo_meeting_sections;
create policy ceo_meeting_sections_staff on public.ceo_meeting_sections
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- ── Per-session section entries (the journal / weekly-grid cell) ─────────────
create table if not exists public.ceo_meeting_section_entries (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references public.ceo_meeting_sessions(id) on delete cascade,
  section_id   uuid not null references public.ceo_meeting_sections(id) on delete cascade,
  content      text not null default '',
  status       text not null default 'not_started' check (status in ('not_started','draft','ready','presented','deferred')),
  prepared_by  uuid references public.profiles(id),
  presented_by uuid references public.profiles(id),
  updated_at   timestamptz not null default now(),
  unique (session_id, section_id)
);
create index if not exists ceo_meeting_section_entries_session_idx on public.ceo_meeting_section_entries (session_id);
alter table public.ceo_meeting_section_entries enable row level security;
drop policy if exists ceo_meeting_section_entries_staff on public.ceo_meeting_section_entries;
create policy ceo_meeting_section_entries_staff on public.ceo_meeting_section_entries
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- ── Section version history (append-only in practice) ────────────────────────
create table if not exists public.ceo_meeting_section_versions (
  id        uuid primary key default gen_random_uuid(),
  entry_id  uuid not null references public.ceo_meeting_section_entries(id) on delete cascade,
  content   text not null,
  edited_by uuid references public.profiles(id),
  edited_at timestamptz not null default now()
);
create index if not exists ceo_meeting_section_versions_entry_idx on public.ceo_meeting_section_versions (entry_id, edited_at desc);
alter table public.ceo_meeting_section_versions enable row level security;
drop policy if exists ceo_meeting_section_versions_staff on public.ceo_meeting_section_versions;
create policy ceo_meeting_section_versions_staff on public.ceo_meeting_section_versions
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- ── Per-person attendance ────────────────────────────────────────────────────
create table if not exists public.ceo_meeting_attendees (
  session_id uuid not null references public.ceo_meeting_sessions(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  status     text not null default 'expected' check (status in ('expected','present','absent','remote','off')),
  primary key (session_id, user_id)
);
alter table public.ceo_meeting_attendees enable row level security;
drop policy if exists ceo_meeting_attendees_staff on public.ceo_meeting_attendees;
create policy ceo_meeting_attendees_staff on public.ceo_meeting_attendees
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- ── Reminder log (idempotent per session/section/threshold) ──────────────────
create table if not exists public.ceo_meeting_reminder_log (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.ceo_meeting_sessions(id) on delete cascade,
  section_id uuid references public.ceo_meeting_sections(id) on delete cascade,
  threshold  text not null,
  sent_at    timestamptz not null default now(),
  unique (session_id, section_id, threshold)
);
alter table public.ceo_meeting_reminder_log enable row level security;
drop policy if exists ceo_meeting_reminder_log_staff on public.ceo_meeting_reminder_log;
create policy ceo_meeting_reminder_log_staff on public.ceo_meeting_reminder_log
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- ── Seed the Management meeting's agenda (idempotent) ────────────────────────
-- Carryover (pinned first) → IR → SOS → Marketing → Admin → Sales → Action Items (last).
do $$
declare mk text := 'mgmt';
begin
  if exists (select 1 from public.ceo_meetings where key = mk)
     and not exists (select 1 from public.ceo_meeting_sections where meeting_key = mk) then
    insert into public.ceo_meeting_sections (meeting_key, position, title, department_id, section_kind, is_required, pinned)
    select mk, 0, 'Carryover', null, 'carryover', true, 'first'
    union all select mk, 1, 'Investor Relations', (select id from public.departments where key='investor_relations'), 'department', true, null
    union all select mk, 2, 'Sales Support',       (select id from public.departments where key='sos'), 'department', true, null
    union all select mk, 3, 'Marketing',           (select id from public.departments where key='marketing'), 'department', true, null
    union all select mk, 4, 'Admin',               (select id from public.departments where key='admin'), 'department', true, null
    union all select mk, 5, 'Sales',               (select id from public.departments where key='sales'), 'department', true, null
    union all select mk, 6, 'Action Items', null, 'action_items', true, 'last';
  end if;
end $$;

-- ── Readiness view: per-section entry status for a session's board ───────────
create or replace view public.v_ceo_meeting_readiness as
select
  e.session_id,
  s.id            as section_id,
  s.meeting_key,
  s.position,
  s.title,
  s.department_id,
  s.section_kind,
  e.status,
  e.prepared_by,
  e.updated_at
from public.ceo_meeting_sections s
join public.ceo_meeting_section_entries e on e.section_id = s.id;
