-- Form D Desk — Investor Mode · §3.2 Firms + §3.5 Activity fields (folded in)
-- Firm rollup of investor-side vehicles. regd_footprint is the sum of visible
-- Reg D vehicles and is NOT AUM — the UI label must carry that qualifier.
-- Additive + idempotent. Review before running.

create table if not exists public.formd_firms (
  id                   uuid primary key default gen_random_uuid(),
  firm_stem            text not null,
  display_name         text not null,
  city                 text,
  state_or_country     text,
  phone                text,
  domain               text,
  first_seen_at        date not null,
  last_filing_at       date not null,
  vehicle_count        int  not null default 0,
  regd_footprint       bigint,          -- sum of visible Reg D vehicles, NOT AUM
  fund_types           text[],
  needs_review         boolean not null default false,
  promoted_at          timestamptz,
  promoted_investor_id uuid references public.prospect_investors(id),
  -- §3.5 activity fields
  last_investment_at         date,
  last_investment_issuer     text,
  last_investment_round_size bigint,    -- the ROUND, not a check
  last_investment_confidence numeric(3,2),
  est_check_size             bigint,    -- an ESTIMATE (median), name carries it
  investments_24mo           int not null default 0,
  sectors_observed           text[],
  activity_band              text not null default 'registry'
    check (activity_band in ('observed', 'single', 'registry')),
  formd_rank                 numeric(5,2),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create unique index if not exists formd_firms_identity_idx
  on public.formd_firms (firm_stem, coalesce(state_or_country, ''));

create index if not exists formd_firms_activity_idx
  on public.formd_firms (last_investment_at desc nulls last);

create table if not exists public.formd_firm_vehicles (
  firm_id          uuid not null references public.formd_firms(id) on delete cascade,
  cik              text not null,
  accession_number text not null,
  primary key (firm_id, cik)
);
