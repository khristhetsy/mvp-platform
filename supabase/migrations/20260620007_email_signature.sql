-- Email signature, appended to outgoing inbox mail. Stored on user_preferences. Additive.

alter table public.user_preferences
  add column if not exists email_signature text;
