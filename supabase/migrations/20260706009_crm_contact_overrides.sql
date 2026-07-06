-- CRM contacts: user edits for Odoo-sourced fields live in a separate `overrides` jsonb,
-- so profile edits persist without mutating the Odoo `raw` payload or the generated columns.
-- getContactProfile prefers overrides over raw when present.
alter table public.crm_contacts
  add column if not exists overrides jsonb not null default '{}'::jsonb;
