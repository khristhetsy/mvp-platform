-- Self service account deletion: a founder requests deletion, the account is
-- blocked for 30 days (they can restore it by signing in), then a daily cron
-- removes it permanently.
alter table public.profiles
  add column if not exists deletion_requested_at timestamptz,
  add column if not exists deletion_scheduled_for timestamptz;

create index if not exists profiles_deletion_scheduled_idx
  on public.profiles (deletion_scheduled_for)
  where deletion_scheduled_for is not null;
