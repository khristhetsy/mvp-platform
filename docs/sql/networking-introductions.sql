-- Networking — introductions sent by us, and the templates that word them.
--
-- Until now a connection came from one attendee clicking Connect in the app.
-- Nothing was emailed, staff saw nothing, and the matching board could only
-- ever read "No request".
--
-- Two tables:
--   · event_introductions — one row per pair per event, with what happened.
--   · event_intro_templates — the invitation and the founder follow-up, edited
--     in the admin rather than hard-coded.
--
-- Matches themselves are still not stored: they are recomputed from the
-- registration answers. A row here only appears once somebody is invited, so
-- the table stays the size of what was actually sent.

create extension if not exists pgcrypto;

do $$ begin
  create type introduction_status as enum ('sent', 'accepted', 'declined');
exception when duplicate_object then null; end $$;

create table if not exists public.event_introductions (
  id              uuid primary key default gen_random_uuid(),
  event_id        uuid not null references public.events(id) on delete cascade,

  -- Registrations, not profiles: a guest who registered without an account is
  -- as introducible as anyone else, and most of this event's 106 are guests.
  investor_reg_id uuid not null references public.registrations(id) on delete cascade,
  founder_reg_id  uuid not null references public.registrations(id) on delete cascade,

  -- Frozen at send time, so the email and the board can never disagree about
  -- why two people were put together.
  score           integer not null default 0,
  shared_sectors  text[]  not null default '{}',

  status          introduction_status not null default 'sent',
  sent_at         timestamptz not null default now(),
  responded_at    timestamptz,

  -- The founder chases the investor. Capped in code at two; stored so the cap
  -- survives a restart and so a person can see how often they were contacted.
  follow_ups      integer not null default 0,
  last_follow_up_at timestamptz,

  -- Minted when the introduction is accepted, by us, from our own provider.
  room_url        text,
  room_expires_at timestamptz,

  created_by      uuid references public.profiles(id),
  created_at      timestamptz not null default now(),

  constraint event_introductions_distinct check (investor_reg_id <> founder_reg_id)
);

-- One introduction per pair per event, whichever way round it was created.
create unique index if not exists event_introductions_pair_idx
  on public.event_introductions (
    event_id,
    least(investor_reg_id::text, founder_reg_id::text),
    greatest(investor_reg_id::text, founder_reg_id::text)
  );

create index if not exists event_introductions_event_idx  on public.event_introductions (event_id);
create index if not exists event_introductions_status_idx on public.event_introductions (event_id, status);

alter table public.event_introductions enable row level security;

drop policy if exists event_introductions_staff on public.event_introductions;
create policy event_introductions_staff on public.event_introductions
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

grant select, insert, update, delete on public.event_introductions to service_role;

-- ── Templates ───────────────────────────────────────────────────────────────
-- Two rows, seeded with sending copy. Edited in the admin; never deleted, so a
-- missing row can't silently stop the mail going out.

create table if not exists public.event_intro_templates (
  kind        text primary key check (kind in ('invitation', 'follow_up')),
  subject     text not null,
  body        text not null,
  updated_by  uuid references public.profiles(id),
  updated_at  timestamptz not null default now()
);

alter table public.event_intro_templates enable row level security;

drop policy if exists event_intro_templates_staff on public.event_intro_templates;
create policy event_intro_templates_staff on public.event_intro_templates
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

grant select, insert, update on public.event_intro_templates to service_role;

insert into public.event_intro_templates (kind, subject, body) values
  (
    'invitation',
    '{{founder_name}} would be worth meeting at {{event_title}}',
    E'Hi {{first_name}},\n\n'
    'You are both registered for {{event_title}}{{shared_line}}.\n\n'
    '{{founder_name}} — {{founder_company}}, Founder.\n\n'
    'If you would like an introduction, accept below. Nothing is shared until you both agree, and no contact details change hands before that.'
  ),
  (
    'follow_up',
    'Still interested in meeting {{founder_name}}?',
    E'Hi {{first_name}},\n\n'
    '{{founder_name}} at {{founder_company}} is hoping to meet you at {{event_title}}{{shared_line}}.\n\n'
    'One click either way and we will stop asking.'
  )
on conflict (kind) do nothing;

-- ── Verify ──────────────────────────────────────────────────────────────────
-- Expect 2 template rows and an empty introductions table.
-- select kind, subject from public.event_intro_templates order by kind;
-- select count(*) from public.event_introductions;
