-- Document "Not applicable" markers.
-- Lets a founder flag a non-critical document type as not-applicable so it is not
-- counted as "missing" in the Document Quality panel. Kept in a dedicated table
-- (not the documents table) so real uploads stay pure and completeness/readiness
-- logic is unaffected.
--
-- Only a restricted set of types may be marked N/A (enforced in the API layer):
--   CUSTOMER_CONTRACTS, LEGAL_DOCUMENTS, OTHER
-- Critical docs (pitch deck, financials, cap table) can never be marked N/A.

create table if not exists public.document_not_applicable (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  document_type text not null,
  reason       text,
  marked_by    uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  unique (company_id, document_type)
);

create index if not exists document_not_applicable_company_idx
  on public.document_not_applicable (company_id);

alter table public.document_not_applicable enable row level security;

-- Founders/owners/admins of the company can read and manage their own markers.
-- Service-role writes (used by the API after ownership verification) bypass RLS.
drop policy if exists "manage own company document_not_applicable" on public.document_not_applicable;
create policy "manage own company document_not_applicable"
  on public.document_not_applicable
  for all
  using (public.user_can_manage_company(company_id))
  with check (public.user_can_manage_company(company_id));
