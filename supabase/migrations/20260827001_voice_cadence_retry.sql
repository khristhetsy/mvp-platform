-- Bound cadence retries. Previously a step whose send kept throwing (or a gate
-- reason like "outside_hours") rescheduled +1h forever with no counter. Add a
-- per-enrollment retry counter so the tick can give up on a step after N tries
-- and advance the contact instead of looping indefinitely.
--
-- Additive + idempotent. Apply on staging, verify, then production.

alter table public.voice_cadence_enrollments
  add column if not exists retry_count int not null default 0;
