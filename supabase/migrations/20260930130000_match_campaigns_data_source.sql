-- Match campaigns, follow-up.
--
-- 1. The founder fields view now carries where industry and stage came from
--    (crm_contacts.overrides _industry_source / _funding_stage_source, e.g.
--    "inferred:low", "guess:default", "crm:extra"), so the data check can hold
--    back AI-inferred and guessed values unless admin includes them.
-- 2. The pipeline stage join is rewritten from a per-row lateral scan (about
--    9 s over 14k founders) to one hashed pass over sales_opportunities.
-- 3. New excluded reason "unconfirmed_data" on match_campaign_founders.
-- Additive: same view columns in the same order, two new columns at the end.

create or replace view public.match_campaign_founder_fields
with (security_invoker = true) as
with opp as (
  select distinct on (o.contact_crm_id) o.contact_crm_id, o.id, s.name as stage_name
  from public.sales_opportunities o
  left join public.sales_stages s on s.id = o.stage_id
  where o.contact_crm_id is not null
  order by o.contact_crm_id, o.updated_at desc nulls last
)
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
  end as founder_type,
  -- Only meaningful when the value came from the override.
  case when cardinality(public.mc_jsonb_texts(c.overrides -> 'Industries')) > 0 then c.overrides ->> '_industry_source' end as industry_source,
  case when cardinality(public.mc_jsonb_texts(c.overrides -> 'Entrepreneur funding stage?')) > 0 then c.overrides ->> '_funding_stage_source' end as stage_source
from public.crm_contacts c
left join opp on opp.contact_crm_id = c.id::text
where c.module = 'founder';

alter table public.match_campaign_founders
  drop constraint if exists match_campaign_founders_excluded_reason_check;
alter table public.match_campaign_founders
  add constraint match_campaign_founders_excluded_reason_check check (excluded_reason in (
    'missing_industry', 'missing_stage', 'unconfirmed_data', 'no_email', 'invalid_email',
    'email_unverified', 'suppressed', 'eu_excluded', 'no_matches'));
