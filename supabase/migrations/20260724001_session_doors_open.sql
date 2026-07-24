-- Early-access control for live sessions. When a session is marked "live", the
-- default is that attendees can only join once the scheduled start time is
-- reached (staff can always enter early to rehearse). Setting doors_open = true
-- lets an admin open the room to attendees early; false re-closes it.
-- Nullable-safe: existing sessions default to closed (time-gated) behaviour.

alter table public.sessions
  add column if not exists doors_open boolean not null default false;
