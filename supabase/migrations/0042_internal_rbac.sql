-- Internal RBAC: roles, permissions, user assignments, and overrides.

create table if not exists public.internal_roles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  label text not null,
  description text,
  rank int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.internal_permissions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  label text not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.internal_role_permissions (
  role_id uuid not null references public.internal_roles(id) on delete cascade,
  permission_id uuid not null references public.internal_permissions(id) on delete cascade,
  granted boolean not null default true,
  primary key (role_id, permission_id)
);

create table if not exists public.internal_user_roles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  role_id uuid not null references public.internal_roles(id),
  is_active boolean not null default true,
  assigned_at timestamptz not null default now(),
  assigned_by uuid references public.profiles(id) on delete set null
);

create table if not exists public.internal_user_permission_overrides (
  user_id uuid not null references public.profiles(id) on delete cascade,
  permission_id uuid not null references public.internal_permissions(id) on delete cascade,
  granted boolean not null,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  primary key (user_id, permission_id)
);

create index if not exists internal_user_roles_role_id_idx on public.internal_user_roles (role_id);
create index if not exists internal_user_permission_overrides_user_idx
  on public.internal_user_permission_overrides (user_id);

insert into public.internal_roles (slug, label, description, rank)
values
  ('regular_user', 'Regular User', 'Minimal internal workspace access', 10),
  ('manager', 'Manager', 'Operational management access', 20),
  ('admin', 'Admin', 'Broad admin access without super-admin controls', 30),
  ('super_admin', 'Super Admin', 'Full internal platform access', 40)
on conflict (slug) do nothing;

insert into public.internal_permissions (slug, label, description)
values
  ('view_admin_dashboard', 'View Admin Dashboard', 'Access the admin workspace dashboard'),
  ('manage_companies', 'Manage Companies', 'Review and manage founder companies'),
  ('manage_investors', 'Manage Investors', 'Review and manage investor profiles'),
  ('review_documents', 'Review Documents', 'Review uploaded diligence documents'),
  ('approve_marketplace', 'Approve Marketplace', 'Approve marketplace publication'),
  ('manage_learning', 'Manage Learning', 'Manage founder learning content'),
  ('manage_page_builder', 'Manage Page Builder', 'Access Page Builder Lab sandbox'),
  ('manage_users', 'Manage Users', 'View and manage internal user permissions'),
  ('assign_roles', 'Assign Roles', 'Assign internal roles to users'),
  ('view_audit_logs', 'View Audit Logs', 'View platform audit logs'),
  ('manage_settings', 'Manage Settings', 'Manage platform settings')
on conflict (slug) do nothing;

insert into public.internal_role_permissions (role_id, permission_id, granted)
select r.id, p.id, true
from public.internal_roles r
cross join public.internal_permissions p
where r.slug = 'super_admin'
on conflict do nothing;

insert into public.internal_role_permissions (role_id, permission_id, granted)
select r.id, p.id, true
from public.internal_roles r
join public.internal_permissions p on p.slug in (
  'view_admin_dashboard',
  'manage_companies',
  'manage_investors',
  'review_documents',
  'approve_marketplace',
  'manage_learning',
  'view_audit_logs',
  'manage_settings'
)
where r.slug = 'admin'
on conflict do nothing;

insert into public.internal_role_permissions (role_id, permission_id, granted)
select r.id, p.id, true
from public.internal_roles r
join public.internal_permissions p on p.slug in (
  'view_admin_dashboard',
  'manage_companies',
  'manage_investors',
  'review_documents',
  'approve_marketplace'
)
where r.slug = 'manager'
on conflict do nothing;

insert into public.internal_role_permissions (role_id, permission_id, granted)
select r.id, p.id, true
from public.internal_roles r
join public.internal_permissions p on p.slug = 'view_admin_dashboard'
where r.slug = 'regular_user'
on conflict do nothing;

create or replace function public.internal_user_role_slug(target_user_id uuid default auth.uid())
returns text
language sql
stable
security definer
set search_path = public
as $$
  select r.slug
  from public.internal_user_roles ur
  join public.internal_roles r on r.id = ur.role_id
  where ur.user_id = target_user_id
    and ur.is_active = true
    and r.is_active = true;
$$;

create or replace function public.internal_user_role_rank(target_user_id uuid default auth.uid())
returns int
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(r.rank, 0)
  from public.internal_user_roles ur
  join public.internal_roles r on r.id = ur.role_id
  where ur.user_id = target_user_id
    and ur.is_active = true
    and r.is_active = true;
$$;

create or replace function public.internal_user_has_permission(
  target_user_id uuid,
  permission_slug text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  perm_id uuid;
  override_granted boolean;
  role_granted boolean;
begin
  if public.is_super_admin_user(target_user_id) then
    return true;
  end if;

  select id into perm_id
  from public.internal_permissions
  where slug = permission_slug;

  if perm_id is null then
    return false;
  end if;

  select o.granted into override_granted
  from public.internal_user_permission_overrides o
  where o.user_id = target_user_id
    and o.permission_id = perm_id;

  if found then
    return override_granted;
  end if;

  select rp.granted into role_granted
  from public.internal_user_roles ur
  join public.internal_role_permissions rp on rp.role_id = ur.role_id
  where ur.user_id = target_user_id
    and ur.is_active = true
    and rp.permission_id = perm_id;

  if found then
    return role_granted;
  end if;

  -- Legacy staff fallback during RBAC transition.
  if exists (
    select 1
    from public.profiles p
    where p.id = target_user_id
      and lower(p.role) in ('admin', 'analyst')
  ) then
    return permission_slug not in ('manage_users', 'assign_roles', 'manage_page_builder');
  end if;

  return false;
end;
$$;

create or replace function public.internal_can_manage_users(target_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin_user(target_user_id)
    or public.internal_user_has_permission(target_user_id, 'manage_users');
$$;

create or replace function public.internal_can_assign_super_admin(target_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin_user(target_user_id);
$$;

alter table public.internal_roles enable row level security;
alter table public.internal_permissions enable row level security;
alter table public.internal_role_permissions enable row level security;
alter table public.internal_user_roles enable row level security;
alter table public.internal_user_permission_overrides enable row level security;

drop policy if exists "internal_roles_read_authenticated" on public.internal_roles;
create policy "internal_roles_read_authenticated"
  on public.internal_roles
  for select
  to authenticated
  using (true);

drop policy if exists "internal_roles_super_admin_write" on public.internal_roles;
create policy "internal_roles_super_admin_write"
  on public.internal_roles
  for all
  to authenticated
  using (public.is_super_admin_user())
  with check (public.is_super_admin_user());

drop policy if exists "internal_permissions_read_authenticated" on public.internal_permissions;
create policy "internal_permissions_read_authenticated"
  on public.internal_permissions
  for select
  to authenticated
  using (true);

drop policy if exists "internal_permissions_super_admin_write" on public.internal_permissions;
create policy "internal_permissions_super_admin_write"
  on public.internal_permissions
  for all
  to authenticated
  using (public.is_super_admin_user())
  with check (public.is_super_admin_user());

drop policy if exists "internal_role_permissions_read_authenticated" on public.internal_role_permissions;
create policy "internal_role_permissions_read_authenticated"
  on public.internal_role_permissions
  for select
  to authenticated
  using (true);

drop policy if exists "internal_role_permissions_super_admin_write" on public.internal_role_permissions;
create policy "internal_role_permissions_super_admin_write"
  on public.internal_role_permissions
  for all
  to authenticated
  using (public.is_super_admin_user())
  with check (public.is_super_admin_user());

drop policy if exists "internal_user_roles_read_own" on public.internal_user_roles;
create policy "internal_user_roles_read_own"
  on public.internal_user_roles
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "internal_user_roles_read_manage_users" on public.internal_user_roles;
create policy "internal_user_roles_read_manage_users"
  on public.internal_user_roles
  for select
  to authenticated
  using (public.internal_can_manage_users());

drop policy if exists "internal_user_roles_super_admin_write" on public.internal_user_roles;
create policy "internal_user_roles_super_admin_write"
  on public.internal_user_roles
  for all
  to authenticated
  using (public.is_super_admin_user())
  with check (public.is_super_admin_user());

drop policy if exists "internal_user_roles_manage_users_write" on public.internal_user_roles;
create policy "internal_user_roles_manage_users_write"
  on public.internal_user_roles
  for insert
  to authenticated
  with check (
    public.internal_can_manage_users()
    and not exists (
      select 1
      from public.internal_roles r
      where r.id = role_id
        and r.slug = 'super_admin'
    )
  );

drop policy if exists "internal_user_roles_manage_users_update" on public.internal_user_roles;
create policy "internal_user_roles_manage_users_update"
  on public.internal_user_roles
  for update
  to authenticated
  using (public.internal_can_manage_users())
  with check (
    public.internal_can_manage_users()
    and not exists (
      select 1
      from public.internal_roles r
      where r.id = role_id
        and r.slug = 'super_admin'
    )
  );

drop policy if exists "internal_overrides_read_own" on public.internal_user_permission_overrides;
create policy "internal_overrides_read_own"
  on public.internal_user_permission_overrides
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "internal_overrides_read_manage_users" on public.internal_user_permission_overrides;
create policy "internal_overrides_read_manage_users"
  on public.internal_user_permission_overrides
  for select
  to authenticated
  using (public.internal_can_manage_users());

drop policy if exists "internal_overrides_super_admin_write" on public.internal_user_permission_overrides;
create policy "internal_overrides_super_admin_write"
  on public.internal_user_permission_overrides
  for all
  to authenticated
  using (public.is_super_admin_user())
  with check (public.is_super_admin_user());

drop policy if exists "internal_overrides_manage_users_write" on public.internal_user_permission_overrides;
create policy "internal_overrides_manage_users_write"
  on public.internal_user_permission_overrides
  for all
  to authenticated
  using (public.internal_can_manage_users())
  with check (public.internal_can_manage_users());

-- Page builder: allow manage_page_builder permission in addition to super admin.
drop policy if exists "page_builder_drafts_super_admin" on public.page_builder_drafts;
create policy "page_builder_drafts_super_admin"
  on public.page_builder_drafts
  for all
  to authenticated
  using (
    public.is_super_admin_user()
    or public.internal_user_has_permission(auth.uid(), 'manage_page_builder')
  )
  with check (
    public.is_super_admin_user()
    or public.internal_user_has_permission(auth.uid(), 'manage_page_builder')
  );

drop policy if exists "page_builder_snapshots_super_admin" on public.page_builder_snapshots;
create policy "page_builder_snapshots_super_admin"
  on public.page_builder_snapshots
  for all
  to authenticated
  using (
    public.is_super_admin_user()
    or public.internal_user_has_permission(auth.uid(), 'manage_page_builder')
  )
  with check (
    public.is_super_admin_user()
    or public.internal_user_has_permission(auth.uid(), 'manage_page_builder')
  );
