-- Idempotent CRM import: track the source contact so re-imports don't duplicate.
alter table public.prospect_investors add column if not exists source_ref text;
-- Full (non-partial) unique index so ON CONFLICT (source_ref) matches it.
-- Postgres treats NULLs as distinct, so manual prospects (null source_ref) are unaffected.
drop index if exists prospect_investors_source_ref_uniq;
create unique index if not exists prospect_investors_source_ref_uniq
  on public.prospect_investors (source_ref);
