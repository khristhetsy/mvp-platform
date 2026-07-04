-- Marketing Hub Lists — soft archive for saved contact lists.
-- Additive: archived lists are hidden from the Prospects directory but kept.

alter table public.marketing_lists
  add column if not exists archived boolean not null default false;

create index if not exists idx_marketing_lists_archived on public.marketing_lists (archived);
