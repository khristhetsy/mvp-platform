-- Private Market weekly emailer (Admin, Private Market board, Weekly emailer).
-- One row per version (founder, investor): the email content, who it goes to and
-- when. The schedule columns match marketing_sequence_schedules so the same PT
-- schedule math runs both. A send log makes every run safe to resume and keeps a
-- recipient from getting the same week twice.

create table if not exists public.private_market_weekly_emails (
  audience           text primary key check (audience in ('founder', 'investor')),
  subject            text not null,
  preheader          text not null default '',
  note               text not null default '',
  button_text        text not null default 'Open the Private Market board',
  sections           jsonb not null default '{}'::jsonb,
  groups             text[] not null default '{}',
  list_ids           uuid[] not null default '{}',
  skip_if_unchanged  boolean not null default false,
  from_name          text,
  from_email         text,
  enabled            boolean not null default false,
  start_date         date,
  end_date           date,
  repeat             text not null default 'weekly'
                       check (repeat in ('once', 'daily', 'weekdays', 'weekly', 'monthly')),
  weekdays           int[] not null default '{1}',
  send_time          text not null default '05:00',
  max_per_run        int not null default 5000 check (max_per_run between 1 and 5000),
  reminder_minutes   int not null default 1440 check (reminder_minutes >= 0),
  unreviewed_action  text not null default 'send' check (unreviewed_action in ('send', 'hold')),
  reviewed_for       timestamptz,
  activated_at       timestamptz not null default now(),
  last_run_for       timestamptz,
  run_sent           int not null default 0,
  run_done           boolean not null default false,
  last_reminder_for  timestamptz,
  updated_by         uuid references public.profiles(id) on delete set null,
  updated_at         timestamptz not null default now()
);

create table if not exists public.private_market_weekly_sends (
  id          uuid primary key default gen_random_uuid(),
  audience    text not null check (audience in ('founder', 'investor')),
  run_for     timestamptz not null,
  email       text not null,
  status      text not null check (status in ('sent', 'failed', 'skipped')),
  error       text,
  created_at  timestamptz not null default now(),
  unique (audience, run_for, email)
);

create index if not exists private_market_weekly_sends_run_idx
  on public.private_market_weekly_sends (audience, run_for);

alter table public.private_market_weekly_emails enable row level security;
alter table public.private_market_weekly_sends enable row level security;
-- service role only, like the other marketing tables.
