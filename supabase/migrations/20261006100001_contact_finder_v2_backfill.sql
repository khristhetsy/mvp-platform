-- Contact finder v2 backfill (run AFTER 20261006100000_contact_finder_v2.sql).
-- Decision 2026-10-06: the lead list carried over from Odoo (both the main CRM
-- export 'odoo' and the investor relations export 'odoo-ir') is recorded as
-- legitimate interest (B2B prospecting). Only fills empty values.
update public.crm_contacts
set lawful_basis = 'legitimate_interest'
where source in ('odoo', 'odoo-ir')
  and lawful_basis is null;
