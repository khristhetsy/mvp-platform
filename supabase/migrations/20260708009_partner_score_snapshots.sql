-- Performance fix (audit C2): partner-score snapshot table. The founder Deploy page
-- and the admin Partner Scores page previously called loadPartnerScore() once PER
-- investor, each running ~7 queries — an unbounded N+1. This table caches the
-- computed PartnerScore per investor, refreshed by the daily orchestration cron;
-- the pages now read all rows in a single .in() query (with a live-compute fallback
-- for investors not yet snapshotted).

create table if not exists public.partner_score_snapshots (
  investor_id uuid primary key references public.profiles(id) on delete cascade,
  score       integer,                          -- 0..100, null when status = 'new'
  tier        text    not null,
  status      text    not null,
  sample_size integer not null default 0,
  payload     jsonb   not null,                 -- full PartnerScore object
  computed_at timestamptz not null default now()
);

alter table public.partner_score_snapshots enable row level security;
drop policy if exists partner_score_snapshots_staff on public.partner_score_snapshots;
create policy partner_score_snapshots_staff on public.partner_score_snapshots
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
