-- Contact Sync fix: the CRM mirror upsert (crm-connectors/mirror.ts) writes a
-- top-level `website` field, but crm_contacts never had that column — so every Odoo
-- import/sync failed with "Could not find the 'website' column of 'crm_contacts'".
-- Add the column so the mirror upsert succeeds.

alter table public.crm_contacts add column if not exists website text;
