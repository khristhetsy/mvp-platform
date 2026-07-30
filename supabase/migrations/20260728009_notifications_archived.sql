alter table public.notifications
  add column if not exists archived_at timestamptz;

create index if not exists notifications_recipient_active_idx
  on public.notifications (recipient_user_id, created_at desc)
  where archived_at is null;
