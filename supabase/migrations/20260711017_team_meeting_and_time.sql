-- Meetings tweaks: rename the weekly management meeting to "Team meeting", and let a
-- session carry its own start time (the New meeting session picker now offers a time).

update public.ceo_meetings set name = 'Team meeting' where key = 'mgmt' and name = 'Management meeting';

alter table public.ceo_meeting_sessions add column if not exists start_time time;
