-- Refresh of the user-deletion referential-integrity policy.
--
-- Migration 20260620002 made every blocking FK to profiles (and auth.users)
-- cascade/set-null so users could be hard-deleted. That was a one-time pass.
-- MANY tables have been added since (calendar, email, KYC, prior deals, business
-- plans, cap tables, events/sessions/marketing, …). Any of those that reference
-- a user WITHOUT an explicit ON DELETE rule default to NO ACTION and silently
-- re-introduce the "Database error deleting user" failure.
--
-- This re-applies the same generic, name-agnostic policy so it covers every
-- table that exists today:
--   OWNED data (NOT NULL or founder_id/investor_id columns) -> ON DELETE CASCADE
--   ACTOR/audit references (nullable)                        -> ON DELETE SET NULL
-- Each step pre-cleans rows that would violate the new policy, so it is safe to
-- re-run. Mirrors 20260620002 §B + a parallel pass for direct auth.users FKs.
--
-- ⚠️ DESTRUCTIVE on already-orphaned data and on owned rows of deleted users.
-- Back up the database first (npm run ops:backup-db) and run on staging before
-- production.

-- ── Every blocking FK to public.profiles ─────────────────────────────────────
do $$
declare r record; do_cascade boolean;
begin
  for r in
    select con.conname,
           con.conrelid::regclass::text as tbl,
           att.attname as col,
           att.attnotnull as notnull
    from pg_constraint con
    join pg_attribute att on att.attrelid = con.conrelid and att.attnum = any (con.conkey)
    where con.contype = 'f'
      and con.confrelid = 'public.profiles'::regclass
      and con.confdeltype in ('a', 'r')   -- no action / restrict = the blockers
  loop
    do_cascade := r.notnull or r.col in ('founder_id', 'investor_id');
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
    if do_cascade then
      execute format('delete from %s where %I is not null and %I not in (select id from public.profiles)',
        r.tbl, r.col, r.col);
      execute format('alter table %s add constraint %I foreign key (%I) references public.profiles(id) on delete cascade',
        r.tbl, r.conname, r.col);
    else
      execute format('update %s set %I = null where %I is not null and %I not in (select id from public.profiles)',
        r.tbl, r.col, r.col, r.col);
      execute format('alter table %s add constraint %I foreign key (%I) references public.profiles(id) on delete set null',
        r.tbl, r.conname, r.col);
    end if;
  end loop;
end $$;

-- ── Every blocking FK directly to auth.users (except profiles.id) ─────────────
do $$
declare r record; do_cascade boolean;
begin
  for r in
    select con.conname,
           con.conrelid::regclass::text as tbl,
           att.attname as col,
           att.attnotnull as notnull
    from pg_constraint con
    join pg_attribute att on att.attrelid = con.conrelid and att.attnum = any (con.conkey)
    where con.contype = 'f'
      and con.confrelid = 'auth.users'::regclass
      and con.conrelid <> 'public.profiles'::regclass  -- leave the profiles.id tie alone
      and con.confdeltype in ('a', 'r')
  loop
    do_cascade := r.notnull or r.col in ('founder_id', 'investor_id', 'user_id', 'profile_id');
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
    if do_cascade then
      execute format('delete from %s where %I is not null and %I not in (select id from auth.users)',
        r.tbl, r.col, r.col);
      execute format('alter table %s add constraint %I foreign key (%I) references auth.users(id) on delete cascade',
        r.tbl, r.conname, r.col);
    else
      execute format('update %s set %I = null where %I is not null and %I not in (select id from auth.users)',
        r.tbl, r.col, r.col, r.col);
      execute format('alter table %s add constraint %I foreign key (%I) references auth.users(id) on delete set null',
        r.tbl, r.conname, r.col);
    end if;
  end loop;
end $$;
