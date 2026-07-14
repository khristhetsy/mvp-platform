-- Make hard-deleting a user work. Deleting an auth user cascades into profiles, but many
-- tables have foreign keys to profiles(id) / auth.users(id) with ON DELETE NO ACTION or
-- RESTRICT, which blocks the delete ("Database error deleting user").
--
-- This relaxes every such blocking FK:
--   • FK column(s) all nullable  -> ON DELETE SET NULL  (keeps the historical row, nulls the ref)
--   • FK column(s) not nullable  -> ON DELETE CASCADE    (row can't exist without the user)
--
-- Idempotent: it only touches constraints currently set to NO ACTION / RESTRICT, so a
-- re-run finds nothing to change.

do $$
declare
  r record;
  def text;
  all_nullable boolean;
  action text;
begin
  for r in
    select con.oid, con.conname, con.conrelid as relid, con.conrelid::regclass as tbl, con.conkey
    from pg_constraint con
    join pg_class frel on frel.oid = con.confrelid
    join pg_namespace fns on fns.oid = frel.relnamespace
    where con.contype = 'f'
      and con.confdeltype in ('a', 'r')   -- a = no action, r = restrict (both block)
      and (
        (fns.nspname = 'public' and frel.relname = 'profiles')
        or (fns.nspname = 'auth' and frel.relname = 'users')
      )
  loop
    select bool_and(not a.attnotnull) into all_nullable
    from pg_attribute a
    where a.attrelid = r.relid and a.attnum = any(r.conkey);

    action := case when all_nullable then 'set null' else 'cascade' end;

    -- Reuse the existing FK definition, stripping any ON DELETE/UPDATE clause.
    def := pg_get_constraintdef(r.oid);
    def := regexp_replace(def, '\s+ON DELETE [A-Z ]+', '', 'i');
    def := regexp_replace(def, '\s+ON UPDATE [A-Z ]+', '', 'i');

    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
    execute format('alter table %s add constraint %I %s on delete %s', r.tbl, r.conname, def, action);

    raise notice 'Relaxed % on % -> on delete %', r.conname, r.tbl, action;
  end loop;
end $$;
