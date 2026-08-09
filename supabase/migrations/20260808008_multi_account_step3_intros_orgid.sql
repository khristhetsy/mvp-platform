-- Multi-account — Step 3 (introduction requests), ADDITIVE HALF ONLY.
-- Adds org_id to the intro-request tables, backfilled via company_id →
-- companies.org_id. Changes NO access — existing RLS still applies. This is the
-- last table in the additive pass across the core founder-scoped surface.

alter table public.intro_requests
  add column if not exists org_id uuid references public.organizations(id);
update public.intro_requests ir
set org_id = c.org_id
from public.companies c
where c.id = ir.company_id and c.org_id is not null and ir.org_id is null;
create index if not exists intro_requests_org_idx on public.intro_requests(org_id);

alter table public.prospect_intro_requests
  add column if not exists org_id uuid references public.organizations(id);
update public.prospect_intro_requests pir
set org_id = c.org_id
from public.companies c
where c.id = pir.company_id and c.org_id is not null and pir.org_id is null;
create index if not exists prospect_intro_requests_org_idx on public.prospect_intro_requests(org_id);

-- VERIFY (expect 0 for both):
--   select 'intro_requests' t, count(*) from public.intro_requests where org_id is null and company_id is not null
--   union all select 'prospect_intro_requests', count(*) from public.prospect_intro_requests where org_id is null and company_id is not null;
