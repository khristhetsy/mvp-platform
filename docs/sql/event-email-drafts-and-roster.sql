-- Event Email — the drafts table, then the new roster toggle.
--
-- The second statement failed with "relation public.event_email_drafts does not
-- exist": migration 20260726006 was never applied here, so inline edits to an
-- event email have had nowhere to save. Both are in one file and both are
-- idempotent, so re-running is safe.

-- ── 1. The drafts table (20260726006) ───────────────────────────────────────
create extension if not exists pgcrypto;

create table if not exists public.event_email_drafts (
  id             uuid primary key default gen_random_uuid(),
  event_id       uuid not null references public.events(id) on delete cascade,
  email_type     text not null,
  subject        text,
  blocks         jsonb,
  theme          jsonb,
  include_banner boolean,
  include_lobby  boolean,
  updated_by     uuid references public.profiles(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table public.event_email_drafts
  drop constraint if exists event_email_drafts_type_check;

alter table public.event_email_drafts
  add constraint event_email_drafts_type_check
  check (email_type in ('invite','reminder','day_of','booklet'));

create unique index if not exists event_email_drafts_event_type_idx
  on public.event_email_drafts (event_id, email_type);

alter table public.event_email_drafts enable row level security;

drop policy if exists event_email_drafts_staff on public.event_email_drafts;

create policy event_email_drafts_staff on public.event_email_drafts
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

grant select, insert, update, delete on public.event_email_drafts to service_role;

-- ── 2. Remember the who's-presenting toggle (20260922004) ───────────────────
-- Defaults true: the roster sections are the point of the change, and an event
-- with an empty roster renders nothing rather than an empty heading.
alter table public.event_email_drafts
  add column if not exists include_roster boolean not null default true;

-- ── Verify ──────────────────────────────────────────────────────────────────
-- Expect 3 rows: include_banner, include_lobby, include_roster.
-- select column_name, data_type, column_default
-- from information_schema.columns
-- where table_schema = 'public' and table_name = 'event_email_drafts'
--   and column_name like 'include_%'
-- order by column_name;
