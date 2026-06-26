-- Migration: 20260626007_icfo_events_sponsor_owner.sql
-- iCFO Events — sponsor self-service. Link a sponsor to a managing user (owner)
-- so they can edit their own booth and see their aggregate metrics + opt-in leads
-- (never raw attendee lists). Lightweight: a foreign key + scoped RLS, no new role.

alter table public.sponsors
  add column if not exists owner_id uuid references public.profiles(id) on delete set null;
create index if not exists sponsors_owner_idx on public.sponsors(owner_id);

-- Owner can update their own sponsor row (booth fields).
drop policy if exists sponsors_owner_update on public.sponsors;
create policy sponsors_owner_update on public.sponsors
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Owner can read the events their sponsor is attached to.
drop policy if exists event_sponsors_owner_read on public.event_sponsors;
create policy event_sponsors_owner_read on public.event_sponsors
  for select using (
    exists (select 1 from public.sponsors s where s.id = sponsor_id and s.owner_id = auth.uid())
  );

-- Owner can read the opt-in leads for their sponsor (the attendees who chose to connect).
drop policy if exists sponsor_leads_owner_sponsor_read on public.sponsor_leads;
create policy sponsor_leads_owner_sponsor_read on public.sponsor_leads
  for select using (
    exists (select 1 from public.sponsors s where s.id = sponsor_id and s.owner_id = auth.uid())
  );
