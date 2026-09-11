-- Two-tier meeting reminders (24h + 1h before). Separate stamps so each tier fires at
-- most once per event. The legacy reminder_sent_at column is left in place, unused.
alter table public.calendar_events
  add column if not exists reminder_24h_sent_at timestamptz,
  add column if not exists reminder_1h_sent_at  timestamptz;
