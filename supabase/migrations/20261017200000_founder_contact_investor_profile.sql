-- Founder My contacts: Admin style investor profile answers on a contact.
-- One JSON object keyed by field (industry, operating_stage, investment_size,
-- use_of_funds, deals_per_year, revenue_range, ebitda_range, arr_range,
-- mrr_range, management_team, check_size_min, check_size_max, and so on).
-- Existing columns are untouched.
alter table public.founder_investor_contacts
  add column if not exists investor_profile jsonb not null default '{}'::jsonb;
