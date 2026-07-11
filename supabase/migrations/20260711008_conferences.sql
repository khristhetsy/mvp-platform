-- Weekly Meeting System — Step 7: Conference events.
-- First-class multi-session events (conferences, summits, talk shows) that the platform
-- runs itself, complementing the general/meeting event_kind on calendar_events. A
-- conference has an agenda of sessions (talks/panels) each with its own time + speaker.
-- is_staff() RLS; app-layer gating for who can create/edit.

create table if not exists public.ceo_conferences (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  kind          text not null default 'conference'
                  check (kind in ('conference','summit','talkshow','webinar')),
  description   text,
  start_date    date not null,
  end_date      date,
  timezone      text not null default 'America/Los_Angeles',
  location      text,
  event_url     text,
  department_id uuid references public.departments(id) on delete set null,
  host_id       uuid references public.profiles(id),
  status        text not null default 'draft'
                  check (status in ('draft','scheduled','live','done','cancelled')),
  created_by    uuid references public.profiles(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists ceo_conferences_when_idx on public.ceo_conferences (start_date desc);

create table if not exists public.ceo_conference_sessions (
  id             uuid primary key default gen_random_uuid(),
  conference_id  uuid not null references public.ceo_conferences(id) on delete cascade,
  title          text not null,
  description    text,
  starts_at      timestamptz,
  ends_at        timestamptz,
  speaker        text,
  session_url    text,
  position       int not null default 0,
  created_at     timestamptz not null default now()
);

create index if not exists ceo_conference_sessions_conf_idx
  on public.ceo_conference_sessions (conference_id, position);

alter table public.ceo_conferences enable row level security;
alter table public.ceo_conference_sessions enable row level security;

drop policy if exists ceo_conferences_staff on public.ceo_conferences;
create policy ceo_conferences_staff on public.ceo_conferences
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists ceo_conference_sessions_staff on public.ceo_conference_sessions;
create policy ceo_conference_sessions_staff on public.ceo_conference_sessions
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

grant select, insert, update, delete on public.ceo_conferences to service_role;
grant select, insert, update, delete on public.ceo_conference_sessions to service_role;
