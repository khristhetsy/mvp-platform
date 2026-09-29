-- Fix: the dedup index must be a plain (non-partial) unique index so it can serve as
-- the ON CONFLICT arbiter for the import's upsert. A partial index (WHERE ... is not
-- null) can't be targeted by supabase-js upsert and made the commit fail.
-- NULLs are distinct in a unique index, so hand-created opportunities (both columns
-- null) still never collide.

drop index if exists public.sales_opportunities_external_uq;

create unique index if not exists sales_opportunities_external_uq
  on public.sales_opportunities (external_source, external_id);
