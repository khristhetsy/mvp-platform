-- Security Advisor fix — "Function Search Path Mutable".
-- Functions without a fixed search_path can be tricked into resolving objects from
-- an attacker-controlled schema; this is especially risky for SECURITY DEFINER
-- helpers (is_admin, dd_*). Pin search_path to trusted schemas on every public
-- function. Non-breaking: public + extensions are where these already resolve.

do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'      -- normal functions (triggers included; skip aggregates/procedures)
  loop
    execute format('alter function %s set search_path = public, extensions', r.sig);
  end loop;
end $$;
