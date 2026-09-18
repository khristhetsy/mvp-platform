-- Documents: many files per category.
--   * label  — optional founder-given name shown next to the file (e.g. "Acme MSA")
--   * the one-pitch-deck-per-company unique index goes; several decks (versions) may coexist,
--     the newest active one is what the analyzer / investor views read.
alter table public.documents add column if not exists label text;
drop index if exists public.documents_one_pitch_deck_per_company;
create index if not exists documents_company_type_status_idx on public.documents (company_id, document_type, status);
