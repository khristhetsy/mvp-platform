-- Spam: threads marked as spam (spam_at set) are filtered out of Inbox/Sent/All
-- and shown in the Spam folder. Can be marked "not spam" to restore. Additive.

alter table public.email_threads
  add column if not exists spam_at timestamptz;
