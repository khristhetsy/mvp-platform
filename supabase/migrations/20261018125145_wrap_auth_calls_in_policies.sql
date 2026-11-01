create table if not exists public._policy_backup_20261018 as
  select * from pg_policies where schemaname = 'public';

do $$
declare
  r record;
  q text;
  w text;
  stmt text;
  n int := 0;
begin
  for r in
    select policyname, tablename, qual, with_check
    from pg_policies
    where schemaname = 'public'
  loop
    q := regexp_replace(r.qual, '(?<!SELECT )auth\.(uid|role|email|jwt)\(\)', '(select auth.\1())', 'g');
    w := regexp_replace(r.with_check, '(?<!SELECT )auth\.(uid|role|email|jwt)\(\)', '(select auth.\1())', 'g');
    if q is distinct from r.qual or w is distinct from r.with_check then
      stmt := format('alter policy %I on public.%I', r.policyname, r.tablename);
      if q is not null then
        stmt := stmt || ' using (' || q || ')';
      end if;
      if w is not null then
        stmt := stmt || ' with check (' || w || ')';
      end if;
      execute stmt;
      n := n + 1;
    end if;
  end loop;
  raise notice 'policies rewritten: %', n;
end
$$;
