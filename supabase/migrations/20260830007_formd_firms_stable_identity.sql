-- Form D Desk — Investor Mode · stable firm identity.
-- The rollup used to delete + reinsert formd_firms every run, so every firm got a
-- new UUID nightly. That broke anything referencing a firm id: promote from a page
-- loaded before the rebuild ("firm not found"), the promoted_at badge, and the
-- connector's investor "promoted" count all reset each morning.
--
-- Fix: the rollup now UPSERTs on (firm_stem, state_or_country) so a firm keeps its
-- id across runs. supabase-js upsert needs a plain-column conflict target, so we
-- replace the coalesce() expression index with a NULLS NOT DISTINCT one (Postgres
-- 15+) that dedupes null states the same way. Additive + idempotent — review first.

-- Normalize existing empty-string states to null so they match the rollup's new
-- identity key (which writes null, never ''), otherwise the first upsert would
-- create a duplicate null-state row alongside the old ''-state one.
update public.formd_firms set state_or_country = null where state_or_country = '';

drop index if exists public.formd_firms_identity_idx;

create unique index if not exists formd_firms_identity_idx
  on public.formd_firms (firm_stem, state_or_country) nulls not distinct;
