-- "Ask for another time" — a button that now does something.
--
-- It shipped in the investor's scheduled email pointing at the founder's own
-- picker link, which would have let an investor reschedule as the founder.
-- A control that cannot honestly run is worse than no control, so the request
-- becomes its own thing: the investor asks, the founder still chooses.

alter table public.event_introductions
  add column if not exists reschedule_requested_at timestamptz,
  -- Optional, in the investor's words. "Could we do after 2?" saves a round
  -- trip that would otherwise happen over email we never see.
  add column if not exists reschedule_note text;

-- The founder's queue: a time was set, and then the investor asked for
-- another one. Distinguished from never-scheduled by scheduled_at.
create index if not exists event_introductions_reschedule_idx
  on public.event_introductions (event_id)
  where reschedule_requested_at is not null;

-- ── Verify ──────────────────────────────────────────────────────────────────
-- select count(*) filter (where reschedule_requested_at is not null) as asked
-- from public.event_introductions;
