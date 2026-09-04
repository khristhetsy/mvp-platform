-- Investor profile: preferred ARR / MRR range of target companies.
-- Free-text ranges (e.g. "$1M – $5M") to mirror the founder's actual ARR/MRR on
-- the CRM side, so matching can compare a range to a value. Nullable — existing
-- profiles are unaffected and the fields are optional in onboarding.

alter table public.investor_profiles
  add column if not exists preferred_arr_range text,
  add column if not exists preferred_mrr_range text;
