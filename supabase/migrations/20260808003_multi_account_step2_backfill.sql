-- Multi-account — Step 2 (backfill). One Founder org + owner membership per
-- existing founder. Additive + idempotent; run AFTER step 1. Verify row counts
-- (orgs created == distinct founders) before proceeding to Step 3.

-- One org per founder (their earliest company names it). Skips founders that
-- already have a membership, so re-running is safe.
insert into public.organizations (name, type, created_via, billing_status, created_by)
select distinct on (c.founder_id)
       coalesce(nullif(trim(c.company_name), ''), 'My company'),
       'founder', 'signup', 'active', c.founder_id
from public.companies c
where c.founder_id is not null
  and not exists (select 1 from public.memberships m where m.user_id = c.founder_id)
order by c.founder_id, c.created_at asc nulls last;

-- Owner membership for every org that doesn't have one yet.
insert into public.memberships (user_id, org_id, role)
select o.created_by, o.id, 'owner'
from public.organizations o
where o.created_by is not null
  and not exists (
    select 1 from public.memberships m where m.user_id = o.created_by and m.org_id = o.id
  );
