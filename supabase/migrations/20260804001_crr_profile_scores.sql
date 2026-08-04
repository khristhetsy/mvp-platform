-- CRR audience-profile scores.
--
-- The 13-factor readiness engine now rolls its factors up into 5 dimensions and
-- re-weights them per audience profile (see src/lib/crr/profiles.ts). We store
-- every profile's score so founder-facing surfaces can read the stage-matched
-- value while investor-facing surfaces read one canonical (Series A) score for
-- comparability. `total_score` / `effective_score` keep their existing meaning;
-- `lead_prescore` is untouched.
--
-- Additive and reversible: all columns are nullable and back-filled lazily on the
-- next scoring run. Safe to apply on staging first, then production.

alter table public.company_readiness_scores
  add column if not exists score_angel                 integer,
  add column if not exists score_seed_institutional    integer,
  add column if not exists score_seriesa_institutional integer,
  add column if not exists score_growth_institutional  integer,
  add column if not exists score_version               text;

comment on column public.company_readiness_scores.score_angel is
  'CRR under the angel profile (narrative/team heavy). 0-100.';
comment on column public.company_readiness_scores.score_seed_institutional is
  'CRR under the seed-institutional profile. 0-100.';
comment on column public.company_readiness_scores.score_seriesa_institutional is
  'CRR under the Series A-institutional profile — the canonical investor-facing score. 0-100.';
comment on column public.company_readiness_scores.score_growth_institutional is
  'CRR under the growth-institutional profile. 0-100.';
comment on column public.company_readiness_scores.score_version is
  'Weighting version stamp (e.g. crr-profiles-v1) so historic scores stay interpretable.';
