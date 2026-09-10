-- Social campaigns: group posts under a named campaign with a manual budget, so the
-- Social Hub can report KPIs and ROI (subscription revenue ÷ budget). Additive.
--
-- Attribution: each campaign has a stable source_tag. Published post links get
-- ?s=<source_tag> appended, which the /fit funnel records as the session source_tag
-- and the Sales Hub handoff writes to the contact's lead_source — so signups (and the
-- subscription revenue they generate) trace back to the campaign that drove them.

create table if not exists public.social_campaigns (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  budget_cents bigint not null default 0,
  -- Short, URL-safe attribution tag (e.g. "camp_ab12cd34"). Unique per campaign.
  source_tag   text not null unique,
  archived_at  timestamptz,
  created_by   uuid,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.social_posts
  add column if not exists campaign_id uuid references public.social_campaigns(id) on delete set null;

create index if not exists social_posts_campaign_idx on public.social_posts (campaign_id);
