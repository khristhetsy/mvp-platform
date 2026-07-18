-- =====================================================================
-- 20260718001_notification_preferences.sql
-- Per-user notification settings (event toggles, delivery, channels).
-- =====================================================================
create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  events jsonb not null default '{}'::jsonb,
  digest_frequency text not null default 'weekly',
  quiet_start time,
  quiet_end time,
  pause_all boolean not null default false,
  critical_override boolean not null default true,
  channel_in_app boolean not null default true,
  channel_email boolean not null default true,
  channel_slack boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.notification_preferences enable row level security;
drop policy if exists "own_notification_prefs" on public.notification_preferences;
create policy "own_notification_prefs" on public.notification_preferences
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
