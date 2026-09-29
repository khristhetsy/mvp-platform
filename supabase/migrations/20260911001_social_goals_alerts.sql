-- Social Media Hub — funnel goals, change alerts, post lifecycle, calendar styling.
-- All additive (create-if-not-exists / add-column-if-not-exists), safe to re-run.
--
-- The Hub tracks a five-stage funnel per campaign: Outreach → Impressions → Clicks
-- → Meetings → Conversions. Goals are set per period grain (week/month/quarter/year)
-- and per period_start, so reporting compares actual vs target and this-period vs the
-- previous comparable period.

-- ── Per-period, per-stage campaign goals ───────────────────────────────────────
-- One row per (campaign, grain, period_start). Any stage target may be null (skip it).
create table if not exists public.social_campaign_goals (
  id               uuid primary key default gen_random_uuid(),
  campaign_id      uuid not null references public.social_campaigns(id) on delete cascade,
  grain            text not null check (grain in ('week', 'month', 'quarter', 'year')),
  period_start     date not null,                 -- first day of the period (Mon / 1st / qtr start / Jan 1)
  goal_outreach    integer,
  goal_impressions integer,
  goal_clicks      integer,
  goal_meetings    integer,
  goal_conversions integer,
  created_by       uuid,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (campaign_id, grain, period_start)
);

create index if not exists social_campaign_goals_lookup_idx
  on public.social_campaign_goals (campaign_id, grain, period_start);

-- ── Change-alert rules ──────────────────────────────────────────────────────────
-- "Notify me when <metric> <direction> by <threshold>%." Evaluated on each queue run
-- and at period close. Direction 'behind_pace' fires when goal pacing < threshold%.
create table if not exists public.social_alert_rules (
  id            uuid primary key default gen_random_uuid(),
  metric        text not null check (metric in ('outreach', 'impressions', 'clicks', 'meetings', 'conversions', 'revenue', 'goal_pacing')),
  direction     text not null check (direction in ('up', 'down', 'behind_pace')),
  threshold_pct numeric not null default 10,       -- percent; for behind_pace it's the pacing floor (e.g. 90)
  grain         text not null default 'week' check (grain in ('week', 'month', 'quarter', 'year')),
  channel       text not null default 'in_app' check (channel in ('in_app', 'email', 'both')),
  campaign_id   uuid references public.social_campaigns(id) on delete cascade,  -- null = all campaigns
  enabled       boolean not null default true,
  last_fired_at timestamptz,
  created_by    uuid,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ── Post lifecycle: archive + soft delete (Library tab) ─────────────────────────
alter table public.social_posts
  add column if not exists archived_at timestamptz,
  add column if not exists deleted_at  timestamptz;

create index if not exists social_posts_archived_idx on public.social_posts (archived_at);
create index if not exists social_posts_deleted_idx  on public.social_posts (deleted_at);

-- ── Calendar styling: per-event color + busy/free (Schedule tab) ────────────────
-- event_color null → falls back to the campaign color in the UI.
alter table public.social_variants
  add column if not exists event_color text,
  add column if not exists busy        boolean not null default true;
