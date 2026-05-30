-- Founder onboarding progress on companies (minimal extension).
-- Rollback: alter table public.companies drop column if exists onboarding_progress_percent,
--   drop column if exists onboarding_completed_at, drop column if exists onboarding_step_state,
--   drop column if exists founder_goals;

alter table public.companies
  add column if not exists onboarding_progress_percent integer not null default 0,
  add column if not exists onboarding_completed_at timestamptz,
  add column if not exists onboarding_step_state jsonb not null default '{}'::jsonb,
  add column if not exists founder_goals text;
