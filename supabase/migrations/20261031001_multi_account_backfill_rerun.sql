-- Multi-account: re-run of Step 2 (backfill) and Step 3 (companies.org_id) for
-- founders who signed up after the Aug 9 backfill.
--
-- Why: 22 founder companies (created Aug 28 to Oct 30) have org_id null and their
-- founders have no membership. Without an organization the Investor Relations Agent
-- cannot be created ("no_org"), and any org-scoped feature treats them as unlinked.
--
-- Same rules as 20260808003 and 20260808004: one founder org per founder who has no
-- membership yet, an owner membership, then companies.org_id set from that org.
-- Additive and idempotent, one transaction. It changes no RLS policy.
--
-- Effect to expect: for these founders getActiveCompanyForUser now takes the org
-- path, which resolves to the same company because org_id is set in this same
-- transaction. Do not split the three statements apart.

begin;

insert into public.organizations (name, type, created_via, billing_status, created_by)
select distinct on (c.founder_id)
       coalesce(nullif(trim(c.company_name), ''), 'My company'),
       'founder', 'signup', 'active', c.founder_id
from public.companies c
where c.founder_id is not null
  and not exists (select 1 from public.memberships m where m.user_id = c.founder_id)
order by c.founder_id, c.created_at asc nulls last;

insert into public.memberships (user_id, org_id, role)
select o.created_by, o.id, 'owner'
from public.organizations o
where o.created_by is not null
  and not exists (
    select 1 from public.memberships m where m.user_id = o.created_by and m.org_id = o.id
  );

-- Link each company to its founder's org, only when the founder has exactly one
-- founder org (no ambiguity) and the company is not linked yet.
update public.companies c
set org_id = o.id
from public.organizations o
where o.created_by = c.founder_id
  and o.type = 'founder'
  and c.org_id is null
  and (select count(*) from public.organizations x
       where x.created_by = c.founder_id and x.type = 'founder') = 1;

do $$
declare n integer;
begin
  select count(*) into n from public.companies where org_id is null and founder_id is not null;
  raise notice 'companies still without an organization: %', n;
end $$;

commit;

-- VERIFY (expected: 0, or only founders who already had a membership):
--   select count(*) from public.companies where org_id is null and founder_id is not null;
--   select count(*) from public.organizations;   -- 5 before, 27 after if all 22 are new
-- ROLLBACK (only if needed, deletes just what this file created):
--   delete from public.organizations where created_via = 'signup' and created_at >= '<run time>';
--   (memberships cascade; then set companies.org_id back to null for those org ids)
