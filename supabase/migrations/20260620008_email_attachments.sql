-- Email attachments (outbound). Files live in the private 'email-attachments'
-- Storage bucket; each message carries lightweight metadata. Additive.

alter table public.email_messages
  add column if not exists attachments jsonb not null default '[]'::jsonb;

-- Private bucket for attachment files. Access is server-side (service role) only.
insert into storage.buckets (id, name, public)
values ('email-attachments', 'email-attachments', false)
on conflict (id) do nothing;
