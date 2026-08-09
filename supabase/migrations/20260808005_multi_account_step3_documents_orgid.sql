-- Multi-account — Step 3 (documents), ADDITIVE HALF ONLY.
-- Adds documents.org_id and backfills it from the parent company's org. Changes
-- NO access — existing RLS on documents still applies. Run after the companies
-- org_id backfill (documents inherit org via company_id → companies.org_id).

alter table public.documents
  add column if not exists org_id uuid references public.organizations(id);

update public.documents d
set org_id = c.org_id
from public.companies c
where c.id = d.company_id
  and c.org_id is not null
  and d.org_id is null;

create index if not exists documents_org_idx on public.documents(org_id);

-- VERIFY (expect 0, ignoring any docs with a null company_id):
--   select count(*) from public.documents d
--   where d.org_id is null and d.company_id is not null;
