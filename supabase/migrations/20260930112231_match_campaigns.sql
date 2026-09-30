-- Match campaigns (Marketing Hub).
--
-- A Match campaign emails founder leads their current investor matches with
-- investor names hidden. No email goes to investors. Additive only: two new
-- tables, one nullable column on marketing_campaigns, one read-only view and a
-- small helper function. Nothing existing is altered or dropped.
--
--   marketing_campaigns.match_config  non-null marks a campaign as type Match
--                                     (group_type stays 'founder', so the
--                                     existing campaign list groups it as today)
--   match_campaign_founders           one row per founder in the campaign: data
--                                     check result, match count, top 3 snapshot,
--                                     send status and funnel timestamps
--   match_campaign_matches            the investors matched to each founder;
--                                     admin can remove one (removed = true)
--   match_campaign_founder_fields     read-only view over crm_contacts
--                                     (module = founder): industry, funding
--                                     stage and the other questionnaire answers
--                                     the team fills, in one place
--
-- Why not investor_founder_matches: that table is the platform matching queue,
-- keyed to platform investor accounts (investor_profile_id NOT NULL, FK to
-- investor_profiles) and companies. Match campaigns match CRM investor contacts
-- to CRM founder leads, neither of which has those ids, so storing them there
-- would mean loosening constraints on a table working code depends on.
--
-- RLS: both tables are staff only. The public match page reads through the
-- service role after verifying a signed token, and only selects columns that
-- carry no investor identity.

-- 1. Campaign type marker -----------------------------------------------------
alter table public.marketing_campaigns
  add column if not exists match_config jsonb;

comment on column public.marketing_campaigns.match_config is
  'Non-null marks a Match campaign. {founder_list_id, founder_filter, weights, daily_cap, preview_count, verified_only, exclude_eu, dry_run, top_n}';

-- 2. Founders in a Match campaign ---------------------------------------------
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

-- 3. Investors matched to each founder ----------------------------------------
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

-- 4. Founder lead fields ------------------------------------------------------
-- Odoo answers arrive as a JSON array or a plain string; this reads either.
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

-- Precedence for each field: the team's override first, then the Odoo
-- questionnaire answer, then the profile summary list.
-- security_invoker: the view runs with the caller's rights, so crm_contacts RLS
-- still applies (the app reads it through the service role).
create or replace view public.match_campaign_founder_fields
with (security_invoker = true) as
select
  c.id,
  c.name,
  c.email,
  c.email_status,
  c.suppressed,
  coalesce(nullif(c.company, ''), c.profile -> 'extra' ->> 'Company Name') as company,
  coalesce(nullif(c.country, ''), nullif(c.overrides ->> 'country', '')) as country,
  case
    when cardinality(public.mc_jsonb_texts(c.overrides -> 'Industries')) > 0 then public.mc_jsonb_texts(c.overrides -> 'Industries')
    when cardinality(public.mc_jsonb_texts(c.profile -> 'extra' -> 'Entrepreneur type of industries?')) > 0 then public.mc_jsonb_texts(c.profile -> 'extra' -> 'Entrepreneur type of industries?')
    else public.mc_jsonb_texts(c.profile -> 'industries')
  end as industries,
  case
    when cardinality(public.mc_jsonb_texts(c.overrides -> 'Entrepreneur funding stage?')) > 0 then public.mc_jsonb_texts(c.overrides -> 'Entrepreneur funding stage?')
    when cardinality(public.mc_jsonb_texts(c.profile -> 'extra' -> 'Entrepreneur funding stage?')) > 0 then public.mc_jsonb_texts(c.profile -> 'extra' -> 'Entrepreneur funding stage?')
    else public.mc_jsonb_texts(c.profile -> 'fundingStages')
  end as funding_stages,
  public.mc_jsonb_texts(coalesce(c.overrides -> 'Entrepreneur seeking amount of capital?', c.profile -> 'extra' -> 'Entrepreneur seeking amount of capital?')) as seeking_amount,
  public.mc_jsonb_texts(coalesce(
    c.overrides -> 'Entrepreneur seeking type of investor(s)?',
    c.profile -> 'extra' -> 'Entrepreneur seeking type of investor(s)?',
    c.profile -> 'extra' -> 'Entrepreneur seeking type of investor(s)? ')) as seeking_investor_types,
  c.supabase_profile_id,
  opp.stage_name as pipeline_stage,
  case
    when c.supabase_profile_id is not null then 'existing_user'
    when opp.id is not null then 'in_pipeline'
    else 'lead'
  end as founder_type
from public.crm_contacts c
left join lateral (
  select o.id, s.name as stage_name
  from public.sales_opportunities o
  left join public.sales_stages s on s.id = o.stage_id
  where o.contact_crm_id = c.id::text
  order by o.updated_at desc nulls last
  limit 1
) opp on true
where c.module = 'founder';

comment on view public.match_campaign_founder_fields is
  'Founder lead fields for Match campaigns. Read only; the team fills industry and stage in crm_contacts.overrides.';
