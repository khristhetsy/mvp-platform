-- Migration: 20260626004_icfo_events_sponsor_leads.sql
-- iCFO Events — Phase 3: opt-in sponsor intros. When an attendee chooses to
-- connect with a sponsor at a booth, a lead is recorded (opt-in only — sponsors
-- never receive raw attendee lists). Staff manage fulfilment of intros.

create table if not exists public.sponsor_leads (
  id         uuid primary key default gen_random_uuid(),
  sponsor_id uuid not null references public.sponsors(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  event_id   uuid references public.events(id) on delete set null,
  message    text check (char_length(message) <= 1000),
  created_at timestamptz not null default now(),
  unique (sponsor_id, profile_id, event_id)
);
create index if not exists sponsor_leads_sponsor_idx on public.sponsor_leads(sponsor_id);
create index if not exists sponsor_leads_profile_idx on public.sponsor_leads(profile_id);

alter table public.sponsor_leads enable row level security;

-- staff: full (they fulfil intros)
drop policy if exists sponsor_leads_staff_all on public.sponsor_leads;
create policy sponsor_leads_staff_all on public.sponsor_leads
  for all using (public.is_staff()) with check (public.is_staff());

-- the attendee can create + read their own opt-in
drop policy if exists sponsor_leads_owner_insert on public.sponsor_leads;
create policy sponsor_leads_owner_insert on public.sponsor_leads
  for insert with check (profile_id = auth.uid());
drop policy if exists sponsor_leads_owner_read on public.sponsor_leads;
create policy sponsor_leads_owner_read on public.sponsor_leads
  for select using (profile_id = auth.uid());
