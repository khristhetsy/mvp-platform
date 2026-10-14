-- Founder Social media: founders get their own posts, campaigns and connected accounts.
-- owner_profile_id NULL = iCFO's own (admin) rows, unchanged. Additive, safe to re-run.

-- 1. Owner column on every social table a founder writes to.
alter table public.social_accounts       add column if not exists owner_profile_id uuid references public.profiles(id) on delete cascade;
alter table public.social_posts          add column if not exists owner_profile_id uuid references public.profiles(id) on delete cascade;
alter table public.social_campaigns      add column if not exists owner_profile_id uuid references public.profiles(id) on delete cascade;
alter table public.social_recurrences    add column if not exists owner_profile_id uuid references public.profiles(id) on delete cascade;
alter table public.social_campaign_goals add column if not exists owner_profile_id uuid references public.profiles(id) on delete cascade;
alter table public.social_alert_rules    add column if not exists owner_profile_id uuid references public.profiles(id) on delete cascade;
alter table public.social_clicks         add column if not exists owner_profile_id uuid references public.profiles(id) on delete cascade;

create index if not exists social_accounts_owner_idx       on public.social_accounts (owner_profile_id);
create index if not exists social_posts_owner_idx          on public.social_posts (owner_profile_id, status);
create index if not exists social_campaigns_owner_idx      on public.social_campaigns (owner_profile_id);
create index if not exists social_recurrences_owner_idx    on public.social_recurrences (owner_profile_id);
create index if not exists social_campaign_goals_owner_idx on public.social_campaign_goals (owner_profile_id);
create index if not exists social_alert_rules_owner_idx    on public.social_alert_rules (owner_profile_id);
create index if not exists social_clicks_owner_idx         on public.social_clicks (owner_profile_id);

-- 2. Account key: a founder may connect a page iCFO already holds without touching the
--    admin row. NULLS NOT DISTINCT keeps admin rows (owner NULL) unique as before.
alter table public.social_accounts drop constraint if exists social_accounts_platform_external_member_id_key;
alter table public.social_accounts
  add constraint social_accounts_owner_platform_member_key
  unique nulls not distinct (owner_profile_id, platform, external_member_id);
-- NOTE: the four upserts in src/lib/social/accounts.ts must change onConflict to
-- "owner_profile_id,platform,external_member_id" in the same release.

-- 3. Held drafts: a post saved at the limit, waiting for the cycle reset.
alter table public.social_posts add column if not exists held_until timestamptz;
create index if not exists social_posts_held_idx on public.social_posts (held_until) where held_until is not null;

-- 4. Plan limits, editable by admin without a deploy.
create table if not exists public.founder_social_limits (
  plan_type        text primary key,
  enabled          boolean not null default false,
  posts_per_month  integer check (posts_per_month is null or posts_per_month >= 0),
  updated_at       timestamptz not null default now(),
  updated_by       uuid references public.profiles(id) on delete set null
);

insert into public.founder_social_limits (plan_type, enabled, posts_per_month) values
  ('master',               true,  null),  -- master switch for the whole feature
  ('founder_free',         false, 0),
  ('founder_basic',        true,  10),
  ('founder_professional', true,  100),
  ('founder_premium',      true,  null)   -- Premium: open, no monthly cap
on conflict (plan_type) do nothing;

-- 5. RLS: service role only, same pattern as social_connect_invites. Founder routes
--    enforce owner_profile_id server side. No founder policies, so sealed tokens in
--    social_accounts are never readable from the browser.
alter table public.founder_social_limits enable row level security;
alter table public.social_accounts       enable row level security;
alter table public.social_posts          enable row level security;
alter table public.social_variants       enable row level security;
alter table public.social_campaigns      enable row level security;
alter table public.social_recurrences    enable row level security;
alter table public.social_campaign_goals enable row level security;
alter table public.social_alert_rules    enable row level security;
alter table public.social_clicks         enable row level security;
