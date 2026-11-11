-- Archive a LinkedIn campaign: hidden from the Campaigns list but kept, and it can be restored.
alter table public.linkedin_campaigns add column if not exists archived_at timestamptz;
