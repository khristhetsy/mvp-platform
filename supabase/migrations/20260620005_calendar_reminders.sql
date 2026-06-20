-- Meeting reminders: track when a reminder email was sent for a calendar event
-- so the cron pass never double-sends. Additive.

alter table public.calendar_events
  add column if not exists reminder_sent_at timestamptz;

-- Supports the cron lookup: confirmed, timed, not-yet-reminded, starting soon.
create index if not exists calendar_events_reminder_due_idx
  on public.calendar_events (start_time)
  where reminder_sent_at is null and status = 'confirmed' and all_day = false;
