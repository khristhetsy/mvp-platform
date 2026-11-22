-- Tighten the user-id lookup functions flagged by the Supabase security advisor.
--
-- These SECURITY DEFINER functions took any user id and answered for it, so a
-- signed-in user could ask "is user X an admin / what is X's role or rank".
-- They now answer for another user only when the caller is that user, staff,
-- the service role, or a direct database connection (no JWT, such as migrations
-- and admin SQL). Anyone else gets false (or null for the role lookups), the
-- same answer a user with no role would get. They return, not raise, because an
-- exception inside an RLS policy would fail the whole query.
--
-- Every policy caller in the live database passes the caller's own id, and no
-- application code calls these functions, so existing access is unchanged.
-- Bodies are otherwise identical to the live definitions.
--
-- internal_can_manage_users and internal_can_assign_super_admin are unchanged:
-- they only call is_super_admin_user / internal_user_has_permission, so they
-- inherit the guard.

create or replace function public.can_inspect_user(target_user_id uuid)
returns boolean
language sql
stable
set search_path to 'public'
as $$
  select coalesce(auth.role(), '') in ('service_role', '')
      or target_user_id is not distinct from auth.uid()
      or public.is_staff();
$$;

create or replace function public.is_super_admin_user(target_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path to 'public', 'extensions'
as $$
  select case
    when public.can_inspect_user(target_user_id) then
      coalesce(
        (
          select p.is_super_admin or lower(p.role) = 'super_admin'
          from public.profiles p
          where p.id = target_user_id
        ),
        false
      )
    else false
  end;
$$;

create or replace function public.can_admin_departments(uid uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select public.can_inspect_user(uid) and (
    exists (select 1 from public.profiles p where p.id = uid and p.role = 'admin')
    or exists (select 1 from public.department_members dm join public.departments d on d.id = dm.department_id where dm.user_id = uid and d.is_admin)
  );
$$;

create or replace function public.is_internal_user(uid uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select public.can_inspect_user(uid)
    and exists (select 1 from public.profiles p where p.id = uid and p.role in ('admin','analyst'));
$$;

create or replace function public.internal_user_role_rank(target_user_id uuid default auth.uid())
returns integer
language sql
stable
security definer
set search_path to 'public', 'extensions'
as $$
  select coalesce(r.rank, 0)
  from public.internal_user_roles ur
  join public.internal_roles r on r.id = ur.role_id
  where public.can_inspect_user(target_user_id)
    and ur.user_id = target_user_id
    and ur.is_active = true
    and r.is_active = true;
$$;

create or replace function public.internal_user_role_slug(target_user_id uuid default auth.uid())
returns text
language sql
stable
security definer
set search_path to 'public', 'extensions'
as $$
  select r.slug
  from public.internal_user_roles ur
  join public.internal_roles r on r.id = ur.role_id
  where public.can_inspect_user(target_user_id)
    and ur.user_id = target_user_id
    and ur.is_active = true
    and r.is_active = true;
$$;

create or replace function public.internal_user_has_permission(target_user_id uuid, permission_slug text)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public', 'extensions'
as $$
declare
  perm_id uuid;
  override_granted boolean;
  role_granted boolean;
begin
  if not public.can_inspect_user(target_user_id) then
    return false;
  end if;

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

  -- Legacy staff fallback: admin/analyst profiles without an RBAC row
  -- get all permissions except manage_users and assign_roles.
  if exists (
    select 1
    from public.profiles p
    where p.id = target_user_id
      and lower(p.role) in ('admin', 'analyst')
  ) then
    return permission_slug not in ('manage_users', 'assign_roles');
  end if;

  return false;
end;
$$;
