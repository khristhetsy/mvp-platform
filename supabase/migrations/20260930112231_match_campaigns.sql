-- Match campaigns (Marketing Hub). ALREADY APPLIED to mvp-platform on 2026-09-30 11:22 UTC
-- through the SQL editor; this file records it in the repo. Additive only.
-- Revised by 20260930112441_match_campaigns_data_source.sql.

alter table public.marketing_campaigns
  add column if not exists match_config jsonb;

comment on column public.marketing_campaigns.match_config is
  'Non-null marks a Match campaign. {founder_list_id, founder_filter, weights, daily_cap, preview_count, verified_only, exclude_eu, dry_run, top_n}';

create table if not exists public.match_campaign_founders (
  id                  uuid primary key default gen_random_uuid(),
  campaign_id         uuid not null references public.marketing_campaigns(id) on delete cascade,
  founder_contact_id  uuid not null references public.crm_contacts(id) on delete cascade,
  email               text,
  company             text,
  industry            text,
  funding_stage       text,
  founder_type        text check (founder_type in ('lead', 'existing_user', 'in_pipeline')),
  match_count         integer not null default 0,
  top_matches         jsonb not null default '[]'::jsonb,
  excluded_reason     text check (excluded_reason in (
                        'missing_industry', 'missing_stage', 'no_email', 'invalid_email',
                        'email_unverified', 'suppressed', 'eu_excluded', 'no_matches')),
  send_status         text not null default 'pending' check (send_status in ('pending', 'sent', 'failed', 'skipped', 'dry_run')),
  sent_at             timestamptz,
  message_id          text,
  send_error          text,
  opened_page_at      timestamptz,
  clicked_call_at     timestamptz,
  clicked_intro_at    timestamptz,
  plan_started_at     timestamptz,
  founder_profile_id  uuid references public.profiles(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (campaign_id, founder_contact_id)
);

create index if not exists match_campaign_founders_campaign_idx
  on public.match_campaign_founders (campaign_id, send_status);
create index if not exists match_campaign_founders_contact_idx
  on public.match_campaign_founders (founder_contact_id);

alter table public.match_campaign_founders enable row level security;

drop policy if exists match_campaign_founders_staff on public.match_campaign_founders;
create policy match_campaign_founders_staff on public.match_campaign_founders
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

create table if not exists public.match_campaign_matches (
  id                   uuid primary key default gen_random_uuid(),
  campaign_founder_id  uuid not null references public.match_campaign_founders(id) on delete cascade,
  investor_contact_id  uuid not null references public.crm_contacts(id) on delete cascade,
  match_score          integer not null,
  investor_type        text,
  sectors              text[] not null default '{}',
  stages               text[] not null default '{}',
  check_band           text,
  reasons              text[] not null default '{}',
  removed              boolean not null default false,
  removed_by           uuid references public.profiles(id) on delete set null,
  removed_at           timestamptz,
  created_at           timestamptz not null default now(),
  unique (campaign_founder_id, investor_contact_id)
);

create index if not exists match_campaign_matches_founder_idx
  on public.match_campaign_matches (campaign_founder_id, removed, match_score desc);

alter table public.match_campaign_matches enable row level security;

drop policy if exists match_campaign_matches_staff on public.match_campaign_matches;
create policy match_campaign_matches_staff on public.match_campaign_matches
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

create or replace function public.mc_jsonb_texts(j jsonb)
returns text[]
language sql
immutable
set search_path = public
as $$
  select case
    when j is null then '{}'::text[]
    when jsonb_typeof(j) = 'array' then coalesce(
      (select array_agg(btrim(v)) from jsonb_array_elements_text(j) v where btrim(v) <> ''), '{}'::text[])
    when jsonb_typeof(j) = 'string' and btrim(j #>> '{}') <> '' then array[btrim(j #>> '{}')]
    else '{}'::text[]
  end
$$;

-- The founder fields view is created here and replaced in the next migration.
