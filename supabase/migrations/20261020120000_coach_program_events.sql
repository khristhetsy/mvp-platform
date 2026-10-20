-- Coached program events for the Investor Outreach Playbook.
--
-- The coached lesson page records what the founder did beyond the three step check ins:
-- opened the lesson, answered the recall questions, answered the company question, took the
-- test, saved a commitment. They are written to coach_step_events with step_index 100 to 104
-- (above any real step), so the latest-event-per-step summary never confuses them with a step.
-- Until this runs, those inserts fail the check constraint and the page carries on without them.
-- No new table, no RLS change: the existing own-rows policy on coach_step_events applies.

alter table public.coach_step_events drop constraint if exists coach_step_events_event_check;
alter table public.coach_step_events
  add constraint coach_step_events_event_check
  check (event = any (array['done'::text, 'stuck'::text, 'skipped'::text, 'opened'::text, 'recall'::text, 'answer'::text, 'test'::text, 'commit'::text]));
