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
