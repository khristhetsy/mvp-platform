-- Quiet-hours time zone. Without it, quiet_start/quiet_end were evaluated in UTC,
-- so "8pm–7am" muting fired at the wrong wall-clock time for most users. Store
-- the IANA zone (e.g. 'America/New_York'); null falls back to UTC.

alter table public.notification_preferences
  add column if not exists timezone text;
