-- Weekly Meeting System — link a conference to an iCFO Event so registrations come from
-- the platform's OWN event registration system (public.registrations), not Eventbrite.
-- The conference reads its linked event's registered/attended counts (zero-copy).

alter table public.ceo_conferences
  add column if not exists event_id uuid references public.events(id) on delete set null;

create index if not exists ceo_conferences_event_idx on public.ceo_conferences (event_id);
