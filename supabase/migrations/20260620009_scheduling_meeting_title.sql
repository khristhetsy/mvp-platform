-- Custom meeting name shown on the booking page (Calendly-style). Additive.

alter table public.scheduling_availability
  add column if not exists meeting_title text;
