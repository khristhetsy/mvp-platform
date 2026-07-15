-- Support fast containment filtering on the Odoo questionnaire fields stored in
-- crm_contacts.raw.__profile.* (industries, capital, funding stages, investor types,
-- operating stages). A GIN index with jsonb_path_ops accelerates @> queries.

create index if not exists crm_contacts_raw_gin on public.crm_contacts using gin (raw jsonb_path_ops);

-- Distinct option values per questionnaire facet, for the Contacts Filters dropdown.
create or replace function public.contact_filter_facets()
returns jsonb
language sql
stable
as $$
  with vals as (
    select k.key,
           jsonb_array_elements_text(c.raw->'__profile'->k.key) as v
    from public.crm_contacts c
    cross join lateral (values ('industries'),('capital'),('fundingStages'),('investorTypes'),('operatingStages')) as k(key)
    where jsonb_typeof(c.raw->'__profile'->k.key) = 'array'
  )
  select coalesce(jsonb_object_agg(key, arr), '{}'::jsonb)
  from (
    select key, jsonb_agg(distinct v order by v) as arr
    from vals
    where v is not null and v <> ''
    group by key
  ) t;
$$;
