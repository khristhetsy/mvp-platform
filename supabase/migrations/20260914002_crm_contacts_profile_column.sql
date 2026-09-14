-- Contacts filters were index-backed but still ~4s: jsonb_path_ops GIN lookups need a
-- recheck, and the recheck detoasts the whole `raw` record (the full Odoo row) for every
-- candidate. `profile` is just raw->'__profile' — a few hundred bytes — kept in sync by
-- Postgres itself. Filters and the GIN move to it, so rechecks read the small value.
alter table public.crm_contacts
  add column if not exists profile jsonb
  generated always as (raw -> '__profile') stored;

create index if not exists crm_contacts_profile_gin
  on public.crm_contacts using gin (profile jsonb_path_ops);

-- Lead-source "is set" / equality on the profile side, without touching raw.
create index if not exists crm_contacts_profile_lead_source_idx
  on public.crm_contacts ((profile ->> 'leadSource'))
  where profile ->> 'leadSource' is not null;
