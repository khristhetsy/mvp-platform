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
