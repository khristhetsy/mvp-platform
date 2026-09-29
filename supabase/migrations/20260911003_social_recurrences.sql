-- Recurring social posts. A recurrence stores the schedule rule + the post template;
-- a cron pass materializes each due occurrence as a normal scheduled post (which then
-- publishes through the queue at its time). Additive, safe to re-run.

create table if not exists public.social_recurrences (
  id            uuid primary key default gen_random_uuid(),
  -- schedule rule
  freq          text not null check (freq in ('daily', 'weekly', 'monthly')),
  interval_n    integer not null default 1 check (interval_n between 1 and 52),
  weekdays      integer[] not null default '{}',   -- 0=Sun..6=Sat, used when freq='weekly'
  time_local    text not null default '08:15',      -- HH:MM
  start_date    date not null,
  end_type      text not null default 'never' check (end_type in ('never', 'on_date', 'after')),
  end_date      date,
  end_count     integer,
  status        text not null default 'active' check (status in ('active', 'paused', 'ended')),
  next_run      timestamptz,                        -- when the next occurrence should materialize
  made_count    integer not null default 0,         -- occurrences created so far
  -- post template (used to build each occurrence)
  campaign_id   uuid references public.social_campaigns(id) on delete set null,
  archetype     text,
  department    text,
  brief         text,
  body          text not null default '',
  comment_text  text,
  link_url      text,
  account_ids   uuid[] not null default '{}',
  variants      jsonb not null default '[]'::jsonb, -- [{accountId, body}]
  created_by    uuid,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists social_recurrences_due_idx
  on public.social_recurrences (next_run) where status = 'active';

-- Link generated posts back to their series (null for one-off posts).
alter table public.social_posts
  add column if not exists recurrence_id uuid references public.social_recurrences(id) on delete set null;

create index if not exists social_posts_recurrence_idx on public.social_posts (recurrence_id);
