-- "Select all" bulk actions: return every matching contact id in ONE row.
-- search_contact_ids returns a set, and PostgREST hands back at most 1,000 rows per
-- request. Paging it re-ran the whole search for every page (about 2.5s each for
-- "Founders not in sales pipeline"), so a 13,000 contact selection hit the 8s
-- statement timeout. An array is a single value, so the cap doesn't apply and the
-- search runs once. Same predicate, same order, same 25,000 cap as search_contact_ids.
create or replace function public.search_contact_id_array(
  p_spec        jsonb,
  p_owner       uuid default null,
  p_group_by    text default null,
  p_group_value text default null,
  p_limit       int  default 25000
) returns uuid[]
language sql stable as $$
  select coalesce(array_agg(x), '{}'::uuid[])
    from public.search_contact_ids(p_spec, p_owner, p_group_by, p_group_value, p_limit) x;
$$;

revoke all on function public.search_contact_id_array(jsonb, uuid, text, text, int) from public, anon, authenticated;
grant execute on function public.search_contact_id_array(jsonb, uuid, text, text, int) to service_role;
