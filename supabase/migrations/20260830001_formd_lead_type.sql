-- Form D Desk — Investor Mode · §3.1 Classifier
-- Adds lead_type to the existing formd_filings table (real columns: is_fund,
-- industry). 'unclassified' is a parse failure, not a default bucket — it reports
-- to the health check (§11). Additive + idempotent. Review before running.

do $$ begin
  create type formd_lead_type as enum ('issuer', 'investor', 'unclassified');
exception when duplicate_object then null; end $$;

alter table public.formd_filings
  add column if not exists lead_type formd_lead_type not null default 'unclassified';

create index if not exists formd_filings_lead_type_idx
  on public.formd_filings (lead_type, date_first_sale desc);

-- Backfill from what the parser already captured: is_fund marks pooled investment
-- vehicles (investor side); anything else with an industry is an operating issuer.
update public.formd_filings
   set lead_type = case
     when is_fund is true          then 'investor'::formd_lead_type
     when industry is not null     then 'issuer'::formd_lead_type
     else 'unclassified'::formd_lead_type
   end
 where lead_type = 'unclassified';
