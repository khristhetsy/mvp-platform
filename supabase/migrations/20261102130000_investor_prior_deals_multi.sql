-- Investor prior deals: a deal can carry several years and several amount ranges.
-- Additive only. The existing year and amount columns stay, so old rows and anything reading them keep working.
-- year keeps the most recent selected year (used for ordering).
alter table public.investor_prior_deals
  add column if not exists years integer[],
  add column if not exists amount_bands text[];
