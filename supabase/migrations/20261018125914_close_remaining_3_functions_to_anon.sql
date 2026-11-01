do $$
declare
  r record;
  n int := 0;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.prosecdef
      and p.proname in ('can_admin_departments','internal_can_assign_super_admin','investor_profiles_guard_approval_fields')
  loop
    execute format('revoke execute on function %s from public, anon', r.sig);
    execute format('grant execute on function %s to authenticated, service_role', r.sig);
    n := n + 1;
  end loop;
  raise notice 'functions updated: %', n;
end
$$;
