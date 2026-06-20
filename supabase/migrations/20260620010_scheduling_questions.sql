-- Host-configurable intake questions for the booking page. Additive.
-- Stored as a JSON list on the host's scheduling settings; booker answers are
-- recorded in the meeting event's description.

alter table public.scheduling_availability
  add column if not exists questions jsonb not null default '[]'::jsonb;
