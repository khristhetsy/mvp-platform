-- ============================================================
-- Multi-role event registration intake.
-- Registrations carry an attendee type + typed answers (the marketing
-- "segment" is just a filter on attendee_type — no separate write).
-- Sponsor / service-provider prospects also create an event_lead.
-- Per the agreed design: this NEVER mutates core profiles or grants access.
-- ============================================================

alter table public.registrations
  add column if not exists attendee_type text
    check (attendee_type in ('investor', 'founder', 'service', 'sponsor')),
  add column if not exists answers jsonb not null default '{}'::jsonb;

create index if not exists registrations_type_idx on public.registrations(event_id, attendee_type);

-- Lead pipeline for prospective sponsors / service providers.
create table if not exists public.event_leads (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  lead_type text not null check (lead_type in ('service', 'sponsor')),
  company text,
  answers jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open', 'contacted', 'won', 'lost')),
  created_at timestamptz not null default now()
);
create index if not exists event_leads_event_idx on public.event_leads(event_id, status, created_at desc);

alter table public.event_leads enable row level security;

create policy event_leads_insert_own on public.event_leads
  for insert with check (profile_id = auth.uid());

create policy event_leads_staff_all on public.event_leads
  for all using (public.is_staff()) with check (public.is_staff());
