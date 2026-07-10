-- Scheduling: offer multiple meeting lengths. Hosts pick which durations they offer
-- (e.g. [30, 60]); the booker chooses one on the public page. Stored as a jsonb int
-- array. Nullable — when absent the app falls back to [slot_minutes] so existing rows
-- keep working. slot_minutes is kept in sync with the first offered duration for any
-- legacy readers.

alter table public.scheduling_availability
  add column if not exists slot_durations jsonb;
