-- Multi-account — Step 3 (founder CRM), ADDITIVE HALF ONLY.
-- Adds org_id to the founder CRM tables and backfills from the owning founder's
-- org (created_by = founder_id). Changes NO access — existing RLS still applies.

alter table public.pipeline_investors
  add column if not exists org_id uuid references public.organizations(id);
update public.pipeline_investors p
set org_id = o.id
from public.organizations o
where o.created_by = p.founder_id and p.org_id is null;
create index if not exists pipeline_investors_org_idx on public.pipeline_investors(org_id);

alter table public.founder_investor_contacts
  add column if not exists org_id uuid references public.organizations(id);
update public.founder_investor_contacts fc
set org_id = o.id
from public.organizations o
where o.created_by = fc.founder_id and fc.org_id is null;
create index if not exists founder_investor_contacts_org_idx on public.founder_investor_contacts(org_id);

-- VERIFY (expect 0 for both):
--   select 'pipeline_investors' t, count(*) from public.pipeline_investors where org_id is null
--   union all
--   select 'founder_investor_contacts', count(*) from public.founder_investor_contacts where org_id is null;
