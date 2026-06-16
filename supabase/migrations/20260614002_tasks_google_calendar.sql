-- Add Google Calendar event ID to tasks
-- Stores the GCal event ID when a task is synced to the investor's Google Calendar.
alter table tasks add column if not exists google_calendar_event_id text;
