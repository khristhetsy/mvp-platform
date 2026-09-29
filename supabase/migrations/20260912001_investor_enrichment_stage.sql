-- Thesis stage on enrichment proposals. The investor's operating-stage preference is
-- their THESIS ("we back pre-seed and seed"), which firms state publicly — so it is
-- extracted from stated text, never inferred, and left empty when nothing is stated.
-- Values are the Odoo operating-stage spellings the matcher compares against
-- (Startup / Prototype / Expand Growth / Small Business / Midsize Company /
-- Large Corporation / Large Company); an array because a thesis can span two bands.
alter table public.investor_enrichment
  add column if not exists proposed_stage text[] not null default '{}';
