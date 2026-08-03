-- Founder "Seeking" and "Company & stage" fields, collected in the onboarding
-- "Raise & stage" step and shown on the founder profile. Stored on companies
-- (multi-selects as comma-separated text, matching use_of_funds). Additive and
-- idempotent. After running, regenerate types: npm run db:types.

alter table public.companies
  add column if not exists seeking_investor_types text,
  add column if not exists seeking_capital_types text,
  add column if not exists active_investor_preference text,
  add column if not exists funding_stage text,
  add column if not exists operating_stage text,
  add column if not exists business_entity text,
  add column if not exists annual_ebitda text,
  add column if not exists management_team text;
