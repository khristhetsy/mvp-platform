-- Weekly Meeting System — event registrations (spec §2.5/§6).
-- Registrations/attendance for conference events, from Eventbrite (webhook), iCapOS, or
-- manual entry. Idempotent on (source, external_id). Feeds the conference registered/
-- attended counts and the ROMI funnel. Service-role writes for the webhook path.

create table if not exists public.ceo_event_registrations (
  id               uuid primary key default gen_random_uuid(),
  conference_id    uuid not null references public.ceo_conferences(id) on delete cascade,
  source           text not null default 'manual'
                     check (source in ('eventbrite','icapos','manual')),
  external_id      text,                              -- provider attendee id (idempotency)
  name             text,
  email            text,
  registrant_type  text,                              -- investor | founder | guest
  registered_at    timestamptz not null default now(),
  attended         boolean,
  created_at       timestamptz not null default now()
);

-- Dedupe provider rows without blocking multiple manual (null external_id) entries.
create unique index if not exists ceo_event_registrations_ext_uniq
  on public.ceo_event_registrations (source, external_id) where external_id is not null;
create index if not exists ceo_event_registrations_conf_idx
  on public.ceo_event_registrations (conference_id);

alter table public.ceo_event_registrations enable row level security;

drop policy if exists ceo_event_registrations_staff on public.ceo_event_registrations;
create policy ceo_event_registrations_staff on public.ceo_event_registrations
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

grant select, insert, update, delete on public.ceo_event_registrations to service_role;
