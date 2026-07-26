-- Event Hub → Event Brochure editions (build spec §4). Additive; no changes to
-- events/sessions/event_presenters/event_sponsors. REVIEW BEFORE APPLYING.

create extension if not exists pgcrypto;

create table if not exists public.event_brochures (
  id                uuid primary key default gen_random_uuid(),
  event_id          uuid not null references public.events(id) on delete cascade,
  base_edition_id   uuid references public.event_brochures(id) on delete set null,
  title             text not null,
  status            text not null default 'draft'
                      check (status in ('draft','generated','archived_import')),
  page_config       jsonb not null default '[]',   -- ordered pages: [{type, included, ...}]
  overrides         jsonb not null default '{}',   -- per-page content overrides
  merge_snapshot    jsonb,                          -- frozen EventMergeData at generate
  size              text not null default 'letter' check (size in ('letter','a4','square')),
  pdf_print_path    text,
  pdf_digital_path  text,
  cover_thumb_path  text,
  generated_at      timestamptz,
  created_by        uuid references public.profiles(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists event_brochures_event_idx on public.event_brochures (event_id);

alter table public.event_brochures enable row level security;

-- Staff-only read/write (mirrors other Event Hub tables).
drop policy if exists event_brochures_staff on public.event_brochures;
create policy event_brochures_staff on public.event_brochures
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

grant select, insert, update, delete on public.event_brochures to service_role;

-- Private storage bucket for generated PDFs (served via signed URLs; a digital copy
-- is only made public when an edition is explicitly published to the event page).
insert into storage.buckets (id, name, public)
values ('event-brochures', 'event-brochures', false)
on conflict (id) do nothing;
