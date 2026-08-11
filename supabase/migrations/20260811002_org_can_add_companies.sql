-- Founder "add a company" entitlement, super-admin controlled.
-- A super admin toggles this per organization in Admin → Accounts. When true,
-- the founder who owns that org may add an additional company (Deal Company)
-- regardless of plan. Default false — nobody can add until explicitly granted.

alter table public.organizations
  add column if not exists can_add_companies boolean not null default false;

-- VERIFY:
--   select id, name, can_add_companies from public.organizations limit 5;
