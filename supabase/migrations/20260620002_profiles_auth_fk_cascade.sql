-- PERMANENT FIX: user-deletion referential integrity.
--
-- Root cause of the recurring admin-list ↔ Supabase Auth drift (and blocked user
-- deletes): no consistent on-delete policy between auth.users, profiles, and the
-- data that references a user; plus dangling rows left by past deletes.
--
-- Policy: OWNED data cascades with the user; ACTOR/audit references set null.
-- This migration is generic and name-agnostic:
--   A. Company/campaign owned-data subtree -> cascade.
--   B. EVERY blocking (no-action / restrict) FK to profiles -> cascade if the
--      column is NOT NULL or an ownership column, else set null.
--   C. Remove orphan profiles (now cascade cleanly).
--   D. profiles.id -> auth.users(id) cascade.
-- Each step pre-cleans rows that already violate the target policy. Re-runnable.
--
-- ⚠️ DESTRUCTIVE on already-orphaned data. Back up the database first
-- (npm run ops:backup-db) and run on staging before production.

-- ── A. Company / campaign owned-data subtree -> cascade ───────────────────────
do $$
declare spec record; cname text;
begin
  for spec in select * from (values
    ('investor_interests', 'campaign_id', 'campaigns'),
    ('documents',          'company_id',  'companies'),
    ('diligence_reports',  'company_id',  'companies'),
    ('campaigns',          'company_id',  'companies'),
    ('admin_reviews',      'company_id',  'companies'),
    ('investor_interests', 'company_id',  'companies')
  ) as t(child, col, parent)
  loop
    for cname in
      select con.conname from pg_constraint con
      join pg_attribute att on att.attrelid = con.conrelid and att.attnum = any (con.conkey)
      where con.conrelid = ('public.'||spec.child)::regclass and con.contype = 'f'
        and con.confrelid = ('public.'||spec.parent)::regclass and att.attname = spec.col
    loop execute format('alter table public.%I drop constraint %I', spec.child, cname); end loop;

    execute format('delete from public.%I where %I is not null and %I not in (select id from public.%I)',
      spec.child, spec.col, spec.col, spec.parent);
    execute format('alter table public.%I add constraint %I foreign key (%I) references public.%I(id) on delete cascade',
      spec.child, spec.child||'_'||spec.col||'_fkey', spec.col, spec.parent);
  end loop;
end $$;

-- ── B. Every blocking FK to profiles -> cascade (owned) or set null (actor) ────
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
    -- Ownership columns (or NOT NULL columns that can't be nulled) cascade.
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

-- ── C. Remove orphan profiles (now cascade cleanly) ───────────────────────────
delete from public.profiles p
where not exists (select 1 from auth.users u where u.id = p.id);

-- ── D. Tie profiles to auth.users ─────────────────────────────────────────────
do $$
declare cname text;
begin
  for cname in
    select conname from pg_constraint
    where conrelid = 'public.profiles'::regclass and contype = 'f'
      and confrelid = 'auth.users'::regclass
  loop execute format('alter table public.profiles drop constraint %I', cname); end loop;
  alter table public.profiles
    add constraint profiles_id_fkey foreign key (id) references auth.users(id) on delete cascade;
end $$;
