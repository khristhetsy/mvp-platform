-- Match campaigns: match review flow.
--
-- Additive only. Nothing existing is altered in a way working code depends on,
-- and nothing is dropped.
--
--   match_sector_adjacency        admin editable list of industries adjacent to a
--                                 founder industry (Healthcare next to
--                                 Biotechnology/Life Science). Matching gates on
--                                 exact, adjacent or generalist sector fit.
--   match_campaign_matches        + sector_tier, matched_sectors, rank (position
--                                 after tier then score), so pages and emails
--                                 show what actually matched, in order
--   match_campaign_founders       + first_profile_view_at, booked_at, booking_id,
--                                 followup_sent_at (review flow funnel)
--   match_campaign_profile_views  one row per founder view of an investor profile
--   crm_contacts                  + hidden_from_founders: investors who asked
--                                 not to be shown are skipped by matching
--
-- Applied to production on Oct 2, 2026. Merged after the follow up sequence
-- (20261002120000_match_sequence.sql), which owns follow ups and per investor
-- view counts (match_campaign_investor_views); followup_sent_at and
-- match_campaign_profile_views below ended up unused by the code and can be
-- dropped in a later cleanup. booked_at is added by both files (if not exists).
--
-- RLS: the new tables are staff only, like the other Match campaign tables. The
-- public founder pages read and write through the service role after verifying
-- the signed founder token.

-- 1. Adjacent industries --------------------------------------------------------
create table if not exists public.match_sector_adjacency (
  industry           text not null,
  adjacent_industry  text not null,
  created_at         timestamptz not null default now(),
  primary key (industry, adjacent_industry)
);

comment on table public.match_sector_adjacency is
  'Match campaigns: industries counted as an adjacent fit for a founder industry. An industry with no rows falls back to synonym families.';

insert into public.match_sector_adjacency (industry, adjacent_industry) values
  ('Biotechnology/Life Science', 'Healthcare'),
  ('Biotechnology/Life Science', 'Medical Devices'),
  ('Biotechnology/Life Science', 'Digital Health')
on conflict do nothing;

alter table public.match_sector_adjacency enable row level security;

drop policy if exists match_sector_adjacency_staff on public.match_sector_adjacency;
create policy match_sector_adjacency_staff on public.match_sector_adjacency
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- 2. What matched, and in what order --------------------------------------------
alter table public.match_campaign_matches
  add column if not exists sector_tier text check (sector_tier in ('exact', 'adjacent', 'generalist')),
  add column if not exists matched_sectors text[] not null default '{}',
  add column if not exists rank integer;

create index if not exists match_campaign_matches_founder_rank_idx
  on public.match_campaign_matches (campaign_founder_id, rank);

-- 3. Review flow funnel ---------------------------------------------------------
alter table public.match_campaign_founders
  add column if not exists first_profile_view_at timestamptz,
  add column if not exists booked_at timestamptz,
  add column if not exists booking_id uuid,
  add column if not exists followup_sent_at timestamptz;

-- The follow up cron reads founders who viewed a profile and have not booked.
create index if not exists match_campaign_founders_followup_idx
  on public.match_campaign_founders (first_profile_view_at)
  where followup_sent_at is null and booked_at is null and first_profile_view_at is not null;

create table if not exists public.match_campaign_profile_views (
  id                   uuid primary key default gen_random_uuid(),
  campaign_founder_id  uuid not null references public.match_campaign_founders(id) on delete cascade,
  match_id             uuid not null references public.match_campaign_matches(id) on delete cascade,
  viewed_at            timestamptz not null default now()
);

create index if not exists match_campaign_profile_views_founder_idx
  on public.match_campaign_profile_views (campaign_founder_id, viewed_at desc);

alter table public.match_campaign_profile_views enable row level security;

drop policy if exists match_campaign_profile_views_staff on public.match_campaign_profile_views;
create policy match_campaign_profile_views_staff on public.match_campaign_profile_views
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- 4. Investors hidden from founders ---------------------------------------------
-- Constant default: a metadata only change on Postgres 11+, no table rewrite.
alter table public.crm_contacts
  add column if not exists hidden_from_founders boolean not null default false;

comment on column public.crm_contacts.hidden_from_founders is
  'Investor asked not to be shown to founders: Match campaign matching skips them.';
