-- Multi-account — Step 3 (companies), ADDITIVE HALF ONLY.
-- Adds companies.org_id and backfills it from the owning founder's org. Changes
-- NO access — every existing RLS policy on companies still applies unchanged.
--
-- The RLS policy swap to is_member(org_id) is intentionally NOT done here:
-- `companies` has an interlocking policy set (founder, staff, investor/marketplace,
-- company_members), not the single owner policy the spec's example assumes. Swapping
-- it needs per-policy review or it will break investor/marketplace/staff access.
-- Verify the backfill (see below) before any policy work.

alter table public.companies
  add column if not exists org_id uuid references public.organizations(id);

-- Each backfilled founder owns exactly one org (created_by = founder). Link every
-- company to its founder's org. Idempotent — only fills nulls.
update public.companies c
set org_id = o.id
from public.organizations o
where o.created_by = c.founder_id
  and c.org_id is null;

create index if not exists companies_org_idx on public.companies(org_id);

-- VERIFY before proceeding to any policy swap:
--   select count(*) from public.companies where org_id is null;
--   -- expected 0 (any remainder = a company whose founder has no org row; fix
--   -- those before adding a NOT NULL constraint or org-scoped policy).
