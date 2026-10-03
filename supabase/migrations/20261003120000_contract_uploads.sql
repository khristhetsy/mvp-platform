-- Sales Hub › Contracts: manually uploaded contracts (PDF) alongside template
-- documents. An uploaded contract has no template; it carries its own title and
-- the uploaded file, and its signature boxes are placed by hand with the
-- e-signature placement tool (signature_requests draft linked from upload).
-- RLS: unchanged (contract_documents keeps its existing staff policy).

alter table public.contract_documents alter column template_id drop not null;
alter table public.contract_documents alter column template_version drop not null;

alter table public.contract_documents
  add column if not exists source text not null default 'template',
  add column if not exists title text,
  add column if not exists upload_path text;

alter table public.contract_documents drop constraint if exists contract_documents_source_check;
alter table public.contract_documents
  add constraint contract_documents_source_check check (
    (source = 'template' and template_id is not null and template_version is not null)
    or (source = 'upload' and upload_path is not null and title is not null)
  );
