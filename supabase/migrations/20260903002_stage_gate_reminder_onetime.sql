-- Support "schedule this reminder" — a staff member can set an exact next-send
-- time. When one_time is true the reminder fires once at next_send_at and then
-- stops (does not re-arm the 3-day cadence); when false it resumes the cadence.

alter table public.stage_gate_reminders
  add column if not exists one_time boolean not null default false;
