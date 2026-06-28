-- ============================================================
-- Investor address (Stage 1 onboarding)
-- The investor's own mailing/residence address. Country feeds
-- founder <-> investor geographic matching; the rest is optional.
-- ============================================================

alter table public.investor_profiles
  add column if not exists address_line1       text,
  add column if not exists address_city        text,
  add column if not exists address_state       text,
  add column if not exists address_postal_code text,
  add column if not exists address_country     text;
