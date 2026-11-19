-- Convert a demo account to a paying one by card (Lemon Squeezy, recurring).
-- While the first payment is outstanding the account stays a comped demo; these
-- columns remember what was sent so the checkout link can be copied or resent,
-- and mark the account as "Pending payment" in the registry.
-- The billing webhook clears them and activates the account on the first payment.
-- No new table, so no new RLS: organizations keeps its existing policies.

alter table public.organizations
  add column if not exists conversion_plan text,
  add column if not exists conversion_name text,
  add column if not exists conversion_email text,
  add column if not exists conversion_sent_at timestamptz;

alter table public.organizations
  drop constraint if exists organizations_conversion_plan_check;
alter table public.organizations
  add constraint organizations_conversion_plan_check
  check (conversion_plan is null or conversion_plan in ('founder_basic', 'founder_professional'));
