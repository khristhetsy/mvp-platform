-- Narrow projection of the five /fit match fields.
--
-- Matching used to scan crm_contacts wide: every row carries the whole Odoo `raw` jsonb,
-- so reading the network cost tens of megabytes per funnel submission. Capping the read
-- kept it fast but meant ranking against ~1,000 of 7,184 investors; paging it fixed
-- coverage and hung the page. Neither is acceptable, because the shape was wrong.
--
-- This table holds only what scoring needs, as plain text[]. Matching can then apply the
-- industry hard filter IN THE DATABASE (GIN index + && overlap) and read back only the
-- handful of investors that could possibly match.
--
-- It is a derived cache, rebuilt from crm_contacts by src/lib/fit/match-index.ts — TS,
-- not PL/pgSQL, so the merge and canonicalisation rules live in exactly one place.
-- Safe to truncate and rebuild at any time.

create table if not exists public.investor_match_index (
  contact_id       uuid primary key references public.crm_contacts(id) on delete cascade,
  company          text not null,
  company_key      text not null,             -- lower(btrim(company)); firm de-dup
  industries       text[] not null default '{}',
  stages           text[] not null default '{}',
  sizes            text[] not null default '{}',
  types            text[] not null default '{}',
  revenues         text[] not null default '{}',
  inv_source       text,
  inv_verified_at  timestamptz,
  updated_at       timestamptz not null default now()
);

-- The industry hard filter is the only predicate pushed into SQL, so it gets the index.
create index if not exists investor_match_index_industries_gin
  on public.investor_match_index using gin (industries);

-- Firm de-dup reads rows grouped by normalised company name.
create index if not exists investor_match_index_company_key_idx
  on public.investor_match_index (company_key);
