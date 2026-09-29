-- Odoo → Sales Hub opportunity import: dedup key.
-- external_source/external_id identify where an opportunity came from so a re-import
-- updates in place instead of duplicating. For the Odoo crm.lead export (which has no
-- lead id column) external_id is the lowercased contact email.

alter table public.sales_opportunities
  add column if not exists external_source text,
  add column if not exists external_id     text;

-- One opportunity per (source, id). Partial unique so hand-created opps (both null)
-- are unaffected.
create unique index if not exists sales_opportunities_external_uq
  on public.sales_opportunities (external_source, external_id)
  where external_source is not null and external_id is not null;
