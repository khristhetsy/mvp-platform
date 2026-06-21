-- Link diligence engagements to an existing company record (optional — free-text
-- company_name still supported for off-platform companies).

alter table public.dd_engagements
  add column if not exists company_id uuid references public.companies(id);

create index if not exists dd_engagements_company_idx on public.dd_engagements(company_id);
