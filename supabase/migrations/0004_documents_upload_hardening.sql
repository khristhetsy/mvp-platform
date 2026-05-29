-- Upload hardening: prevent duplicate pitch decks, speed up listing.

-- One pitch deck per company.
create unique index if not exists documents_one_pitch_deck_per_company
  on public.documents (company_id)
  where document_type = 'PITCH_DECK';

-- Fast listing/filtering by company.
create index if not exists documents_company_created_at_idx
  on public.documents (company_id, created_at desc);

create index if not exists documents_company_document_type_idx
  on public.documents (company_id, document_type);

