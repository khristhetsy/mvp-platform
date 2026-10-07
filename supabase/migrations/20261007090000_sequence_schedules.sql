-- Scheduled sends for existing sequences (Sales hub, Sequences). A schedule says
-- when a sequence's pending batches go out on their own: a date range, a repeat
-- rule and a send time in Pacific Time. Batches can be reviewed, held, or moved
-- to a one off time; an unreviewed batch still sends unless the schedule says hold.

create table if not exists public.marketing_sequence_schedules (
  sequence_id        uuid primary key references public.marketing_sequences(id) on delete cascade,
  enabled            boolean not null default true,
  start_date         date not null,
  end_date           date,
  repeat             text not null default 'weekdays'
                       check (repeat in ('once', 'daily', 'weekdays', 'weekly', 'monthly')),
  weekdays           int[] not null default '{1,2,3,4,5}',
  send_time          text not null default '09:00',
  timezone           text not null default 'America/Los_Angeles',
  max_per_run        int  not null default 100 check (max_per_run between 1 and 5000),
  reminder_minutes   int  not null default 60 check (reminder_minutes >= 0),
  unreviewed_action  text not null default 'send' check (unreviewed_action in ('send', 'hold')),
  activated_at       timestamptz not null default now(),
  last_run_for       timestamptz,
  run_sent           int not null default 0,
  run_done           boolean not null default false,
  last_reminder_for  timestamptz,
  updated_by         uuid references public.profiles(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

alter table public.marketing_sequence_schedules enable row level security;
-- service role only, like marketing_sequence_batches.

alter table public.marketing_sequence_batches
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null,
  add column if not exists on_hold     boolean not null default false,
  add column if not exists send_after  timestamptz;

-- Move the batches already waiting for approval onto a schedule: every sequence
-- with a pending batch and no schedule gets weekdays at 9:00 AM PT, starting today
-- (PT), no end date, 100 per run, sending even if not reviewed. activated_at = now()
-- means a run time that already passed today is not caught up.
insert into public.marketing_sequence_schedules (sequence_id, start_date)
select distinct b.sequence_id, (now() at time zone 'America/Los_Angeles')::date
from public.marketing_sequence_batches b
where b.status = 'pending'
on conflict (sequence_id) do nothing;
