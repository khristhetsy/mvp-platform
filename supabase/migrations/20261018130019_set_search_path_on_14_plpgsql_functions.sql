do $$
declare
  r record;
  n int := 0;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_language l on l.oid = p.prolang
    where p.pronamespace = 'public'::regnamespace
      and p.prokind = 'f'
      and l.lanname = 'plpgsql'
      and p.proconfig is null
      and p.proname in (
        'autopause_non_reg_cf_listings','contacts_spec_where','count_contact_buckets',
        'crm_contacts_sync_profile','enforce_reg_cf_only','formd_firm_stem','formd_rollup_firms',
        'investor_profile_merge','ir_match_stage_event','promote_prospect_investor',
        'sales_forecast_block_mutation','sales_journal_guard','search_contact_ids','search_contacts'
      )
  loop
    execute format('alter function %s set search_path = public, pg_temp', r.sig);
    n := n + 1;
  end loop;
  raise notice 'functions updated: %', n;
end
$$;
