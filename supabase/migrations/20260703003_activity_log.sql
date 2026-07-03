-- Broaden the unified touch log so it can hold every interaction type on a
-- contact — calls, texts, emails, meetings, and manual notes — for a single
-- activity timeline on the record. Adds who logged a manual entry.

alter table public.outreach_touches drop constraint if exists outreach_touches_channel_check;
alter table public.outreach_touches
  add constraint outreach_touches_channel_check
  check (channel in ('voice', 'sms', 'whatsapp', 'email', 'note', 'meeting'));

alter table public.outreach_touches add column if not exists logged_by uuid references public.profiles(id) on delete set null;
