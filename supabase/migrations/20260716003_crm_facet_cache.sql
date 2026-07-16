-- Cache of the Contacts Filters option lists. Computing distinct questionnaire values
-- on demand scans ~24k rows (slow on cold serverless starts). The values change only
-- when Odoo re-syncs, so we precompute them into a single row and read that instantly.
-- The API self-refreshes this row when it's older than a day.

create table if not exists public.crm_facet_cache (
  id         text primary key default 'default',
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Seed immediately using the in-DB function (one fast aggregation, not 24 REST reads).
insert into public.crm_facet_cache (id, data)
select 'default', public.contact_filter_facets()
on conflict (id) do update set data = excluded.data, updated_at = now();

-- Make the new table readable via the REST API right away.
notify pgrst, 'reload schema';
