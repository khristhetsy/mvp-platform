-- One confirmed booking per host and start time. bookSlot claims the slot by inserting
-- the booking row first, so two requests for the same slot can no longer both succeed.
-- Cancelled, completed and no show rows do not hold a slot.
create unique index if not exists scheduling_bookings_host_slot_uidx
  on public.scheduling_bookings (host_id, start_time)
  where status = 'confirmed';
