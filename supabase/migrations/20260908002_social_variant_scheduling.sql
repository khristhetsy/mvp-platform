-- Social Media Hub scheduling: per-variant scheduled time, Google Calendar link,
-- and a 'parked' status (approved but undated — sits in the unscheduled rail, the
-- cron ignores it). The calendar/rail split is driven by scheduled_at presence.

alter table public.social_variants
  add column if not exists scheduled_at  timestamptz,
  add column if not exists gcal_event_id text;

-- Widen the status check to allow 'parked'. 'draft' is included for forward safety.
alter table public.social_variants
  drop constraint if exists social_variants_status_check;
alter table public.social_variants
  add constraint social_variants_status_check
  check (status in ('draft', 'parked', 'queued', 'publishing', 'published', 'failed', 'skipped', 'archived'));

-- Calendar reads scan by scheduled_at.
create index if not exists social_variants_scheduled_idx
  on public.social_variants (scheduled_at)
  where scheduled_at is not null;
