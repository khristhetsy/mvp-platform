-- AI usage limits + events.
--
-- Some founder tools make paid Anthropic API calls (pitch deck analyzer, and any
-- other feature listed in AI_COST_FEATURES). This lets an admin cap how many times
-- each plan can RUN those tools inside a rolling window, and records each run so we
-- can enforce it. Viewing a saved result does NOT create an event, so it never counts.

-- Admin-editable caps, keyed by (feature, plan). Missing row = code default.
--   max_runs NULL  = unlimited
--   period         = 'week' | 'month'  (rolling window length)
create table if not exists public.ai_usage_limits (
  id         uuid primary key default gen_random_uuid(),
  feature    text not null,
  plan       text not null,
  max_runs   integer,
  period     text not null default 'week' check (period in ('week', 'month')),
  updated_at timestamptz not null default now(),
  unique (feature, plan)
);

-- One row per successful paid run. Rolling counts query this table.
create table if not exists public.ai_usage_events (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  feature    text not null,
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_events_lookup
  on public.ai_usage_events (profile_id, feature, created_at desc);

-- Server enforces limits with the service-role client; lock the tables down by default.
alter table public.ai_usage_limits enable row level security;
alter table public.ai_usage_events enable row level security;
