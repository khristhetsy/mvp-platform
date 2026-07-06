-- CRM contacts: expose the Odoo "Created on" date for the admin list (display + sorting).
-- Odoo stores create_date as "YYYY-MM-DD HH:MM:SS", which sorts correctly as text.
alter table public.crm_contacts
  add column if not exists created_on text generated always as (raw ->> 'create_date') stored;

create index if not exists idx_crm_contacts_created_on on public.crm_contacts (created_on);
