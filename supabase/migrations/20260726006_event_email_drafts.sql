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
