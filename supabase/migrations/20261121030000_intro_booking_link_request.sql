-- When an investor asked for a new Book a time link after the first one ran out
-- (Nov 21, 2026). Shown to the founder as "Investor requested a new link".
-- Safe to run again.
alter table public.event_introductions
  add column if not exists booking_link_requested_at timestamptz;
