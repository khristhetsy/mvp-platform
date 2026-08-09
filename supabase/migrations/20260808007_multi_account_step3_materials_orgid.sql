-- Multi-account — Step 3 (readiness materials), ADDITIVE HALF ONLY.
-- Adds org_id to the company-scoped materials tables, backfilled via
-- company_id → companies.org_id. Changes NO access — existing RLS still applies.

alter table public.diligence_reports
  add column if not exists org_id uuid references public.organizations(id);
update public.diligence_reports r
set org_id = c.org_id
from public.companies c
where c.id = r.company_id and c.org_id is not null and r.org_id is null;
create index if not exists diligence_reports_org_idx on public.diligence_reports(org_id);

alter table public.pitch_decks
  add column if not exists org_id uuid references public.organizations(id);
update public.pitch_decks pd
set org_id = c.org_id
from public.companies c
where c.id = pd.company_id and c.org_id is not null and pd.org_id is null;
create index if not exists pitch_decks_org_idx on public.pitch_decks(org_id);

alter table public.pitch_deck_analyses
  add column if not exists org_id uuid references public.organizations(id);
update public.pitch_deck_analyses pa
set org_id = c.org_id
from public.companies c
where c.id = pa.company_id and c.org_id is not null and pa.org_id is null;
create index if not exists pitch_deck_analyses_org_idx on public.pitch_deck_analyses(org_id);

-- VERIFY (expect 0 for all three):
--   select 'diligence_reports' t, count(*) from public.diligence_reports where org_id is null and company_id is not null
--   union all select 'pitch_decks', count(*) from public.pitch_decks where org_id is null and company_id is not null
--   union all select 'pitch_deck_analyses', count(*) from public.pitch_deck_analyses where org_id is null and company_id is not null;
