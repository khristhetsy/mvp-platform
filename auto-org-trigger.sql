-- Optional. Creates a founder organization automatically when a company is inserted for a founder with no membership.
-- Guarded: any failure inside the trigger is swallowed so a company insert is never blocked.
create or replace function public.companies_auto_org()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_org uuid;
begin
  if new.org_id is not null or new.founder_id is null then
    return new;
  end if;
  if exists (select 1 from public.memberships m where m.user_id = new.founder_id) then
    return new;
  end if;
  if not exists (select 1 from public.profiles p where p.id = new.founder_id and p.role = 'founder') then
    return new;
  end if;

  begin
    insert into public.organizations (name, type, created_via, billing_status, created_by)
    values (coalesce(nullif(trim(new.company_name), ''), 'My company'), 'founder', 'signup', 'active', new.founder_id)
    returning id into new_org;

    insert into public.memberships (user_id, org_id, role)
    values (new.founder_id, new_org, 'owner')
    on conflict do nothing;

    new.org_id := new_org;
  exception when others then
    raise warning 'companies_auto_org skipped for founder %: %', new.founder_id, sqlerrm;
    new.org_id := null;
  end;

  return new;
end;
$$;

drop trigger if exists trg_companies_auto_org on public.companies;
create trigger trg_companies_auto_org
  before insert on public.companies
  for each row execute function public.companies_auto_org();

-- ROLLBACK: drop trigger if exists trg_companies_auto_org on public.companies;
