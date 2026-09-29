-- Introductions — the time and the link, set by the founder.
--
-- Accepting used to be the end of it: we minted a 24-hour video room and said
-- "a conversation is open". Two things were wrong with that. The founder — the
-- one actually chasing — was never told. And a room minted the moment someone
-- accepts is dead long before an event three weeks out.
--
-- So the founder sets a slot inside the event window and brings the meeting
-- link, and the investor is told the time. That makes an accepted introduction
-- something that can now stall, which is why the reminder counters are here
-- too: an investor who said yes is waiting on somebody.

alter table public.event_introductions
  add column if not exists scheduled_at   timestamptz,
  add column if not exists scheduled_end  timestamptz,
  -- Whatever the founder brings: Meet, Zoom, Teams. Not minted by us.
  add column if not exists meeting_url    text,
  add column if not exists scheduled_by   uuid references public.profiles(id),
  add column if not exists scheduled_set_at timestamptz,
  -- Chasing the founder for a time is a different message from chasing the
  -- investor for an answer, so it is counted separately.
  add column if not exists founder_reminders integer not null default 0,
  add column if not exists last_founder_reminder_at timestamptz;

-- The founder's own diary: every slot they have already given away. Read when
-- their picker renders, so they cannot promise 1:30 to three investors.
create index if not exists event_introductions_founder_slot_idx
  on public.event_introductions (founder_reg_id, scheduled_at)
  where scheduled_at is not null;

-- Accepted but nobody has set a time — the board's stalled list, and the
-- reminder pass's queue.
create index if not exists event_introductions_awaiting_slot_idx
  on public.event_introductions (event_id)
  where status = 'accepted' and scheduled_at is null;

-- A time without a link, or a link without a time, is half a meeting.
do $$ begin
  alter table public.event_introductions
    add constraint event_introductions_schedule_complete
    check (
      (scheduled_at is null and meeting_url is null)
      or (scheduled_at is not null and meeting_url is not null)
    );
exception when duplicate_object then null; end $$;

-- ── Verify ──────────────────────────────────────────────────────────────────
-- Expect the new columns, and zero rows scheduled so far.
-- select count(*) filter (where scheduled_at is not null) as scheduled,
--        count(*) filter (where status = 'accepted' and scheduled_at is null) as awaiting
-- from public.event_introductions;
