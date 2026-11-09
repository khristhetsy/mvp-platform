-- LinkedIn outreach: a message for people you are already connected with (no invite).
-- Both columns are additive and nullable, so campaigns approved before this keep their approval.
alter table public.linkedin_campaigns add column if not exists connected_message_text text;
alter table public.linkedin_targets add column if not exists messaged_at timestamptz;
