-- Sales Hub › Contracts: an uploaded contract carries its contract type, and its
-- recipient is chosen last (just before the cover email). Until then an
-- uploaded draft has no contact. Template documents and anything sent keep a
-- contact, enforced by the check below.
-- RLS: unchanged (contract_documents keeps its existing staff policy).

alter table public.contract_documents alter column contact_id drop not null;

alter table public.contract_documents drop constraint if exists contract_documents_contact_check;
alter table public.contract_documents
  add constraint contract_documents_contact_check check (
    contact_id is not null or (source = 'upload' and status = 'draft')
  );

alter table public.contract_documents add column if not exists contract_type text;

alter table public.contract_documents drop constraint if exists contract_documents_contract_type_check;
alter table public.contract_documents
  add constraint contract_documents_contract_type_check check (
    contract_type is null
    or contract_type in ('due_diligence_services', 'safe', 'convertible_note', 'series_a', 'stock_and_cash')
  );
