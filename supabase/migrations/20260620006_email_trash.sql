-- Inbox folders: soft-delete (Trash). Deleting moves a thread to Trash
-- (trashed_at set); it can be restored or purged. Additive.

alter table public.email_threads
  add column if not exists trashed_at timestamptz;

-- Active (non-trashed) threads list query.
create index if not exists email_threads_owner_active_idx
  on public.email_threads (owner_id, last_message_at desc)
  where trashed_at is null;
