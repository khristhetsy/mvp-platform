-- Booth "Join meeting" link (Google Meet). Set by pasting a meet.google.com URL
-- or generated from the connected Google account. Attendees click "Join meeting"
-- on the booth to enter a live Google Meet with the sponsor's rep.
alter table public.sponsors add column if not exists meeting_url text;
