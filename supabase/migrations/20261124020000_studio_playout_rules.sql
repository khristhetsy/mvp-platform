-- Spotlight playout rule, set per event by staff. Nullable: null means "not set yet",
-- and the player then uses its built in 5 second break.
-- No new table, so no new RLS policy: the existing policies on public.events still apply.

alter table public.events
  add column if not exists spotlight_break_seconds integer
    check (spotlight_break_seconds is null or spotlight_break_seconds between 1 and 60);
