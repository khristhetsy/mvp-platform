-- Open as founder access: what each department can do while staff act as a founder.
-- One row per department and item. An item is a founder menu href, or an acting: key for
-- account actions (terms, payments, credentials, connections). A MISSING row means ON, so
-- release changes nothing and a new menu item opens by default. Rows are only written when an
-- admin switches something. Admin is a department like any other here (no code bypass).

create table if not exists public.department_founder_access (
  department_id uuid not null references public.departments(id) on delete cascade,
  item_key text not null,
  enabled boolean not null default true,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  primary key (department_id, item_key)
);

alter table public.department_founder_access enable row level security;

-- Internal staff read. Only department admins write. Founders and investors see nothing.
drop policy if exists department_founder_access_read on public.department_founder_access;
drop policy if exists department_founder_access_write on public.department_founder_access;
create policy department_founder_access_read on public.department_founder_access
  for select to authenticated using (public.is_internal_user((select auth.uid())));
create policy department_founder_access_write on public.department_founder_access
  for all to authenticated
  using (public.can_admin_departments((select auth.uid())))
  with check (public.can_admin_departments((select auth.uid())));
