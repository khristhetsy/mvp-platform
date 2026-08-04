-- Soft-archive for investor onboarding records.
--
-- Admins can archive an investor to hide it from the default admin list without
-- losing the record, KYC, messages, or audit trail. `archived_at` null = active;
-- a timestamp = archived. Fully reversible (set back to null to restore).
-- Additive and idempotent — safe to apply on staging first, then production.

alter table public.investor_profiles
  add column if not exists archived_at timestamptz;

comment on column public.investor_profiles.archived_at is
  'When set, the investor is archived (hidden from the default admin list). Null = active. Reversible.';
