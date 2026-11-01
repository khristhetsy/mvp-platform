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
      and p.proname in ('get_user_features','get_companies_pledge_summaries')
  loop
    execute format('revoke execute on function %s from public, anon', r.sig);
    execute format('grant execute on function %s to authenticated, service_role', r.sig);
    n := n + 1;
  end loop;
  if n <> 2 then
    raise exception 'expected 2 functions, found %', n;
  end if;
end
$$;
