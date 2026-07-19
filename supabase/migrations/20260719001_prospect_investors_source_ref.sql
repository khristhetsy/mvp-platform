-- Idempotent CRM import: track the source contact so re-imports don't duplicate.
alter table public.prospect_investors add column if not exists source_ref text;
create unique index if not exists prospect_investors_source_ref_uniq
  on public.prospect_investors (source_ref)
  where source_ref is not null;
