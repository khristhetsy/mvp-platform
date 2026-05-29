-- Founder settings: add website/logo fields + tighten update permissions.

alter table public.companies
  add column if not exists website text,
  add column if not exists logo_url text;

create or replace function public.user_can_manage_company(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.company_members cm
    where cm.company_id = target_company_id
      and cm.user_id = auth.uid()
      and cm.role in ('owner','admin')
  )
  or exists (
    select 1
    from public.companies c
    where c.id = target_company_id
      and c.founder_id = auth.uid()
  );
$$;

-- Replace broad update policy with owner/admin-only.
drop policy if exists "companies_update_member" on public.companies;
create policy "companies_update_member"
  on public.companies for update to authenticated
  using (public.user_can_manage_company(id))
  with check (public.user_can_manage_company(id));

