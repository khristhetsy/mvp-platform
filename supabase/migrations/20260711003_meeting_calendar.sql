-- Weekly Meeting System — Step 3 (Calendar & Meet).
-- Additive extensions to the existing calendar_events table for meeting/conference
-- linkage, plus a per-session Google Meet link on the meeting log. Google push itself
-- reuses the CEO Hub calendar integration (src/lib/ceo/calendar.ts + google-access-token).
-- (meeting_type_id in the spec maps to a meeting_key text FK, since we extend ceo_meetings
--  rather than a new meeting_types table.)

alter table public.calendar_events add column if not exists meeting_key        text references public.ceo_meetings(key) on delete set null;
alter table public.calendar_events add column if not exists department_id       uuid references public.departments(id) on delete set null;
alter table public.calendar_events add column if not exists linked_record_type  text;   -- deal | client | prospect
alter table public.calendar_events add column if not exists linked_record_id    uuid;
alter table public.calendar_events add column if not exists event_kind          text default 'general';  -- general | meeting | conference | talkshow

-- Per-session Meet link captured from Google when a session is pushed to Calendar.
alter table public.ceo_meeting_sessions add column if not exists meet_link text;
