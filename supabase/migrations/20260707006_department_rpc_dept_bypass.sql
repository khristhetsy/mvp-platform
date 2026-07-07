-- Scope by department, not role: get_user_features bypasses ONLY for members of an
-- is_admin department. (can_admin_departments still lets legacy platform admins write
-- to the department tables via RLS — that's unchanged.) Unassigned users are handled
-- as full-access in application code (rollout safety), so legacy admins keep working.

create or replace function public.get_user_features(p_user_id uuid)
returns table (feature_key text, label text, hub_key text, path text, sort_order int)
language sql stable security definer set search_path = public as $$
  -- Bypass: member of an is_admin department → every active feature.
  select f.key, f.label, f.hub_key, f.path, f.sort_order
  from public.features f
  where f.is_active and exists (
    select 1 from public.department_members dm
    join public.departments d on d.id = dm.department_id
    where dm.user_id = p_user_id and d.is_admin
  )
  union
  -- Otherwise: distinct enabled grants across the user's active departments.
  select f.key, f.label, f.hub_key, f.path, f.sort_order
  from public.features f
  join public.department_features df on df.feature_id = f.id and df.enabled
  join public.department_members dm on dm.department_id = df.department_id and dm.user_id = p_user_id
  join public.departments d on d.id = df.department_id and d.is_active
  where f.is_active;
$$;
