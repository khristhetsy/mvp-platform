-- Investor capital types (2026-09-24).
--
-- The matching core has scored "capital type" (10 points) since it was added,
-- comparing the founder's "Seeking capital type" with what the investor offers.
-- Platform investors had nowhere to say what they offer, so the factor never
-- scored for them. This adds that column; the investor onboarding form fills it
-- from the existing capital_type option list. No new options are created.
--
-- Stored as labels, the same way preferred_sectors / preferred_stages are, so
-- the core's text comparison works unchanged. Empty by default: an investor who
-- has not answered simply does not score on capital type, as today.

alter table public.investor_profiles
  add column if not exists capital_types text[] not null default '{}';

comment on column public.investor_profiles.capital_types is
  'Capital types the investor offers, as labels from the capital_type option list. Read by the matching core (capital type factor).';
