-- search_contacts: pick the page BEFORE touching wide columns.
--
-- v1 projected raw->>'phone' / raw->>'mobile' in the same query as count(*) over(),
-- so Postgres detoasted the full Odoo `raw` record for every matching row (7k+ for
-- Investors) before LIMIT could cut it to 50 — "canceling statement due to statement
-- timeout". Now: (1) page ids from the narrow columns + sort, (2) exact total from the
-- same predicate, (3) wide columns only for the 50 rows on the page.

create or replace function public.search_contacts(
  p_spec        jsonb,
  p_owner       uuid     default null,
  p_group_by    text     default null,
  p_group_value text     default null,
  p_sort        text     default 'name',
  p_dir         text     default 'asc',
  p_offset      int      default 0,
  p_limit       int      default 50
) returns table (
  id uuid, name text, email text, company text, phone text, source text, external_id text,
  contact_type text, country text, created_on text, synced_at timestamptz, assignee_ids uuid[],
  raw_phone text, raw_mobile text, ls_profile text, ls_override text, total bigint
)
language plpgsql stable as $$
declare
  where_sql text := public.contacts_spec_where(p_spec, p_owner, p_group_by, p_group_value);
  sort_col  text := case when p_sort in ('name', 'company', 'email', 'country', 'created_on') then p_sort else 'name' end;
  sort_dir  text := case when lower(p_dir) = 'desc' then 'desc' else 'asc' end;
begin
  return query execute format($q$
    with page as (
      select c.id
        from public.crm_contacts c
       where %1$s
       order by c.%2$I %3$s nulls last, c.id
      offset %4$s limit %5$s
    ),
    tot as (
      select count(*)::bigint as total from public.crm_contacts c where %1$s
    )
    select c.id, c.name, c.email, c.company, c.phone, c.source, c.external_id,
           c.contact_type, c.country, c.created_on, c.synced_at, c.assignee_ids,
           c.raw->>'phone', c.raw->>'mobile', c.profile->>'leadSource', c.overrides->>'lead_source',
           tot.total
      from page p
      join public.crm_contacts c on c.id = p.id
      cross join tot
     order by c.%2$I %3$s nulls last, c.id
  $q$, where_sql, sort_col, sort_dir, greatest(p_offset, 0), least(greatest(p_limit, 1), 200));
end $$;

revoke all on function public.search_contacts(jsonb, uuid, text, text, text, text, int, int) from public, anon, authenticated;
grant execute on function public.search_contacts(jsonb, uuid, text, text, text, text, int, int) to service_role;
