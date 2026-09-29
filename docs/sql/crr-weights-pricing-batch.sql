-- iCapOS — CRR weight sets, pricing sets, dimension advice
-- Fixes: "Could not find the table 'public.crr_weight_sets' in the schema cache"
--
-- Safe to re-run in full. Every create is IF NOT EXISTS, every policy is
-- preceded by DROP POLICY IF EXISTS, and both seed INSERTs are guarded by
-- WHERE NOT EXISTS. Run the whole thing; already-applied parts no-op.

-- ===================================================================
-- 20260919001_crr_score_version_text.sql
-- ===================================================================
-- Fix: company_readiness_scores.score_version is still `integer`.
--
-- 0071 created it as `integer not null default 1`. 20260804001 tried to add it as
-- `text` with `add column if not exists` — the column already existed, so Postgres
-- silently skipped it and the type never changed. The scorer writes SCORE_VERSION
-- ("crr-profiles-v1"), so every write failed with:
--   invalid input syntax for type integer: "crr-profiles-v1"
-- which is why re-scoring has been a no-op since the profile weights landed.
--
-- Existing values (1) cast cleanly to '1'; the column stays NOT NULL.
alter table public.company_readiness_scores
  alter column score_version drop default;

alter table public.company_readiness_scores
  alter column score_version type text using score_version::text;

alter table public.company_readiness_scores
  alter column score_version set default 'crr-profiles-v1';

comment on column public.company_readiness_scores.score_version is
  'Weighting version stamp (e.g. crr-profiles-v1) so historic scores stay interpretable.';


-- ===================================================================
-- 20260919002_crr_weight_sets.sql
-- ===================================================================
-- CRR weights become data instead of code constants.
--
-- Until now the 13 factor maxima, the four audience profiles, the bands and the
-- traction floors lived in src/lib/ai/readiness-scoring.ts and src/lib/crr/profiles.ts,
-- so changing them meant a deploy. This table holds them as versioned rows: one
-- active set at a time, every save a new row, nothing edited in place.
--
-- company_readiness_scores is already append-only (each scoring run INSERTs and
-- readers take the latest per company), so it doubles as the per-company score
-- timeline — it only needed to record WHY a row appeared and which weights made it.

create table if not exists public.crr_weight_sets (
  id           uuid primary key default gen_random_uuid(),
  version      text not null unique,                 -- 'crr-profiles-v2'; stamped onto scores
  profiles     jsonb not null,                       -- { angel: {narrative,team,financial,traction,capTable}, ... } each summing to 100
  factors      jsonb not null,                       -- { revenue_cashflow: 15, ... } summing to 100
  bands        jsonb not null,                       -- { strong: 75, solid: 60, developing: 40 }
  floors       jsonb not null,                       -- { seriesA_institutional: { minTraction: 40, cap: 'Developing' }, ... }
  is_active    boolean not null default false,
  reason       text,                                 -- why this version exists (required in the UI)
  impact       jsonb,                                -- preview snapshot taken at save: per-company before/after
  created_by   uuid references public.profiles(id),
  created_at   timestamptz not null default now()
);

-- Exactly one active set.
create unique index if not exists crr_weight_sets_one_active
  on public.crr_weight_sets ((is_active)) where is_active;
create index if not exists crr_weight_sets_created_idx on public.crr_weight_sets (created_at desc);

alter table public.crr_weight_sets enable row level security;
drop policy if exists "admin_full_access" on public.crr_weight_sets;
create policy "admin_full_access" on public.crr_weight_sets
  for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'analyst')));

-- Why each score row exists, and under which weights.
alter table public.company_readiness_scores
  add column if not exists change_kind   text,   -- 'scored' | 'rescored' | 'weights' | null (legacy)
  add column if not exists change_reason text,
  add column if not exists weight_set_id uuid references public.crr_weight_sets(id);

create index if not exists company_readiness_scores_company_created_idx
  on public.company_readiness_scores (company_id, created_at desc);

-- Seed: today's code constants, so nothing changes until someone saves a new version.
insert into public.crr_weight_sets (version, profiles, factors, bands, floors, is_active, reason, created_by)
select
  'crr-profiles-v1',
  '{
     "angel":                 { "narrative": 30, "team": 30, "financial": 15, "traction": 15, "capTable": 10 },
     "seed_institutional":    { "narrative": 10, "team": 30, "financial": 15, "traction": 25, "capTable": 20 },
     "seriesA_institutional": { "narrative": 10, "team": 15, "financial": 25, "traction": 30, "capTable": 20 },
     "growth_institutional":  { "narrative": 5,  "team": 10, "financial": 35, "traction": 30, "capTable": 20 }
   }'::jsonb,
  '{
     "revenue_cashflow": 15, "customer_traction": 13, "founder_team": 11, "market_evidence": 10,
     "unit_economics": 10, "governance_legal": 9, "ip_moat": 8, "burn_runway": 8,
     "exit_strategy": 7, "pitch_quality": 4, "deal_structure": 3, "industry_alignment": 1, "impact_esg": 1
   }'::jsonb,
  '{ "strong": 75, "solid": 60, "developing": 40 }'::jsonb,
  '{
     "seed_institutional":    { "minTraction": 20, "cap": "Developing" },
     "seriesA_institutional": { "minTraction": 40, "cap": "Developing" },
     "growth_institutional":  { "minTraction": 40, "cap": "Developing" }
   }'::jsonb,
  true,
  'Seeded from the code defaults that shipped in August.',
  null
where not exists (select 1 from public.crr_weight_sets);

comment on table public.crr_weight_sets is
  'Versioned CRR weighting. One active row; saves append. company_readiness_scores.weight_set_id points at the row that produced a score.';


-- ===================================================================
-- 20260919003_pricing_sets.sql
-- ===================================================================
-- Subscription pricing becomes data instead of five hand-typed copies.
--
-- Today a price is written in PLAN_PRICES (cents), in priceLabel strings inside
-- plans.ts AND billing/pricing.ts, again in content/pricing.ts for the public page,
-- again in two AI prompts, and again in i18n keys literally named
-- founder_basic_499_mo — which is why /upgrade still quotes the old model.
--
-- One active set; saving appends a version. What LemonSqueezy actually charges is
-- NOT stored here (their prices are immutable and set in their dashboard) — the
-- admin screen reads the variant price live and warns when the two disagree.

create table if not exists public.pricing_sets (
  id                 uuid primary key default gen_random_uuid(),
  version            text not null unique,        -- 'pricing-v2'
  plans              jsonb not null,              -- { founder_basic: { cents, label, sublabel }, ... }
  add_company_cents  integer not null default 80000,
  reason             text,
  -- How existing subscribers are treated. 'grandfather' leaves their billed price
  -- alone; 'migrate' records that they were moved at the provider.
  existing_policy    text not null default 'grandfather' check (existing_policy in ('grandfather', 'migrate')),
  effective_at       timestamptz not null default now(),
  is_active          boolean not null default false,
  created_by         uuid references public.profiles(id),
  created_at         timestamptz not null default now()
);

create unique index if not exists pricing_sets_one_active on public.pricing_sets ((is_active)) where is_active;
create index if not exists pricing_sets_created_idx on public.pricing_sets (created_at desc);

alter table public.pricing_sets enable row level security;
drop policy if exists "staff_read" on public.pricing_sets;
create policy "staff_read" on public.pricing_sets
  for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'analyst')));

-- Seed: exactly today's numbers, so nothing moves until someone saves.
insert into public.pricing_sets (version, plans, add_company_cents, reason, is_active, created_by)
select
  'pricing-v1',
  '{
     "founder_free":         { "cents": 0,      "label": "$0",                  "sublabel": "Readiness" },
     "founder_basic":        { "cents": 4900,   "label": "$49",                 "sublabel": "/month" },
     "founder_professional": { "cents": 19900,  "label": "$199",                "sublabel": "/month" },
     "founder_managed_ir":   { "cents": 350000, "label": "Pricing on request",  "sublabel": "3-month minimum", "contactSales": true }
   }'::jsonb,
  80000,
  'Seeded from the code constants.',
  true,
  null
where not exists (select 1 from public.pricing_sets);

comment on table public.pricing_sets is
  'Versioned subscription pricing. One active row; every save appends. The amount actually charged lives at LemonSqueezy — this is what the app stores, computes MRR from, and shows.';


-- ===================================================================
-- 20260919004_crr_dimension_advice.sql
-- ===================================================================
-- Cache for the per-dimension improvement suggestions shown on /admin/readiness.
--
-- Generated on demand (one Claude call the first time a dimension card is
-- opened) and kept here so re-opening it is free. company_readiness_scores is
-- append-only — every scoring run INSERTs a new row — so a re-score starts with
-- an empty cache automatically and stale advice can never outlive its score.
--
-- Shape: { "traction": { "generatedAt": "...", "source": "ai" | "flags",
--                        "items": [ { "title": ..., "detail": ..., "factor": ... } ] }, ... }
-- The point gains are NOT stored: they are recomputed from the factor scores on
-- every read, so they can never drift from the weighting that is active today.

alter table public.company_readiness_scores
  add column if not exists dimension_advice jsonb not null default '{}'::jsonb;

comment on column public.company_readiness_scores.dimension_advice is
  'Cached improvement suggestions per CRR dimension for this score row. Written on first open, discarded naturally when the next scoring run inserts a new row.';


-- ===================================================================
-- Tell PostgREST to pick up the new tables (clears the schema-cache error)
-- ===================================================================
notify pgrst, 'reload schema';

-- Verify: expect crr_weight_sets = 1 active row, pricing_sets = 1 active row
select 'crr_weight_sets' as tbl, count(*) total, count(*) filter (where is_active) active from public.crr_weight_sets
union all
select 'pricing_sets', count(*), count(*) filter (where is_active) from public.pricing_sets;
