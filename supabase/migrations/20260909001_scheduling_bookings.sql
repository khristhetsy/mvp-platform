-- Structured record of every booking made through the iCapOS scheduler, so the rich
-- Calendly-style detail (invitee, event type, slot, Meet link, intake Q&A) is stored
-- and viewable — not just buried in the calendar event's text description.

create table if not exists public.scheduling_bookings (
  id             uuid primary key default gen_random_uuid(),
  host_id        uuid references public.profiles(id) on delete set null,
  event_id       uuid,                 -- linked calendar_events row (host event)
  event_type     text,                 -- meeting title / event type shown to the booker
  booker_name    text,
  booker_email   text,
  booker_phone   text,
  contact_crm_id uuid,                 -- resolved crm_contacts match (by email), if any
  start_time     timestamptz not null,
  end_time       timestamptz not null,
  timezone       text,
  meet_url       text,
  note           text,
  answers        jsonb not null default '[]'::jsonb,   -- [{label, value}]
  status         text not null default 'confirmed'
    check (status in ('confirmed', 'cancelled', 'completed', 'no_show')),
  created_at     timestamptz not null default now()
);

create index if not exists scheduling_bookings_host_idx on public.scheduling_bookings (host_id, start_time desc);
create index if not exists scheduling_bookings_contact_idx on public.scheduling_bookings (contact_crm_id);
create index if not exists scheduling_bookings_start_idx on public.scheduling_bookings (start_time desc);

alter table public.scheduling_bookings enable row level security;
