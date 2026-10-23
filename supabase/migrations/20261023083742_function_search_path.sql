-- Audit fix (Supabase advisor 0011): pin search_path on functions that had a
-- role-mutable one. ALTER only, function bodies are unchanged. Functions that
-- exist only in the live database are skipped, so this also replays on a fresh one.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any (array['contact_filter_facets','contact_role','investor_profile_canon','contact_industries_override','contact_in_sales_pipeline','search_contact_id_array','person_name_key','phone_key','phone_to_e164','phone_to_e164_v2'])
  loop
    execute format('alter function %s set search_path = public, extensions', r.sig);
  end loop;
end $$;
