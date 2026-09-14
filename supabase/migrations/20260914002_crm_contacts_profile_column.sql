-- Contacts filters were index-backed but still ~4s: jsonb_path_ops GIN lookups need a
-- recheck, and the recheck detoasts the whole `raw` record (the full Odoo row) for every
-- candidate. `profile` is just raw->'__profile' — a few hundred bytes. Filters and the
-- GIN move to it, so rechecks read the small value.
--
-- NOT a generated column: that rewrites the whole table in one statement, which the
-- Supabase SQL editor's timeout kills on ~27k large rows. A plain column + trigger gives
-- the same guarantee, and the backfill runs in batches (see the bottom of this file).

alter table public.crm_contacts add column if not exists profile jsonb;

create or replace function public.crm_contacts_sync_profile()
returns trigger language plpgsql as $$
begin
  new.profile := coalesce(new.raw -> '__profile', '{}'::jsonb);
  return new;
end $$;

drop trigger if exists crm_contacts_sync_profile on public.crm_contacts;
create trigger crm_contacts_sync_profile
  before insert or update of raw on public.crm_contacts
  for each row execute function public.crm_contacts_sync_profile();

-- Backfill: run this statement repeatedly until it reports 0 rows updated.
-- (2,000 rows per run stays well inside the editor's timeout.)
--   update public.crm_contacts
--      set profile = coalesce(raw -> '__profile', '{}'::jsonb)
--    where id in (select id from public.crm_contacts where profile is null limit 2000);

-- Indexes: run once the backfill reports 0 (small column, builds in seconds).
create index if not exists crm_contacts_profile_gin
  on public.crm_contacts using gin (profile jsonb_path_ops);

create index if not exists crm_contacts_profile_lead_source_idx
  on public.crm_contacts ((profile ->> 'leadSource'))
  where profile ->> 'leadSource' is not null;
