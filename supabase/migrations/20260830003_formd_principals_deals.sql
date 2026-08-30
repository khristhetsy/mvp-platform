-- Form D Desk — Investor Mode · §3.3 Principals + §3.4 Deal events
-- Principals are identified by a keyed HMAC hash computed in memory; the street
-- address that feeds the hash is NEVER persisted (§6, acceptance test 5).
-- Additive + idempotent. Review before running.

create table if not exists public.formd_principals (
  id            uuid primary key default gen_random_uuid(),
  firm_id       uuid not null references public.formd_firms(id) on delete cascade,
  first_name    text not null,
  last_name     text not null,
  relationship  text[] not null,
  identity_hash text not null,          -- hmac(name|street|postal); plaintext discarded
  first_seen_at date not null,
  last_seen_at  date not null,
  created_at    timestamptz not null default now()
);

create unique index if not exists formd_principals_identity_idx
  on public.formd_principals (identity_hash);

create table if not exists public.formd_deal_events (
  id                 uuid primary key default gen_random_uuid(),
  principal_id       uuid not null references public.formd_principals(id) on delete cascade,
  firm_id            uuid not null references public.formd_firms(id) on delete cascade,
  issuer_cik         text not null,
  issuer_name        text not null,
  issuer_accession   text not null,
  issuer_industry    text,             -- carried onto the event; sector without a 2nd join
  date_of_first_sale date,
  amount_sold        bigint,
  total_offering     bigint,
  investor_count     int,
  securities_type    text,
  federal_exemption  text,
  confidence         numeric(3,2) not null,
  created_at         timestamptz not null default now()
);

create unique index if not exists formd_deal_events_unique_idx
  on public.formd_deal_events (principal_id, issuer_accession);
