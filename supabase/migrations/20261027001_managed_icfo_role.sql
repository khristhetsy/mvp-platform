-- Managed by iCFO: a company role for the iCFO team on Premium, Done for you accounts.
-- Additive. Widens the role check on company_members and company_invites.
-- Safe to re-run. Rollback: re-add the old checks after removing any managed_icfo rows.
begin;

do $$
declare c record;
begin
  for c in
    select conrelid::regclass as tbl, conname
    from pg_constraint
    where contype = 'c'
      and conrelid in ('public.company_members'::regclass, 'public.company_invites'::regclass)
      and pg_get_constraintdef(oid) ilike '%role%'
  loop
    execute format('alter table %s drop constraint %I', c.tbl, c.conname);
  end loop;
end $$;

alter table public.company_members
  add constraint company_members_role_check
  check (role in ('owner', 'admin', 'member', 'managed_icfo'));

alter table public.company_invites
  add constraint company_invites_role_check
  check (role in ('admin', 'member', 'managed_icfo'));

commit;
