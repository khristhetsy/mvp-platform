-- Departments — access RPCs. One call resolves a user's effective feature set.
-- Admin bypass (is_admin department OR legacy platform-admin role) → all active
-- features. Otherwise → union of enabled grants across the user's departments.

create or replace function public.get_user_features(p_user_id uuid)
returns table (feature_key text, label text, hub_key text, path text, sort_order int)
language sql stable security definer set search_path = public as $$
  -- Admin bypass: every active feature.
  select f.key, f.label, f.hub_key, f.path, f.sort_order
  from public.features f
  where f.is_active and public.can_admin_departments(p_user_id)
  union
  -- Non-admin: distinct enabled grants across all of the user's active departments.
  select f.key, f.label, f.hub_key, f.path, f.sort_order
  from public.features f
  join public.department_features df on df.feature_id = f.id and df.enabled
  join public.department_members dm on dm.department_id = df.department_id and dm.user_id = p_user_id
  join public.departments d on d.id = df.department_id and d.is_active
  where f.is_active;
$$;

create or replace function public.get_user_hubs(p_user_id uuid)
returns table (hub_key text)
language sql stable security definer set search_path = public as $$
  select distinct hub_key from public.get_user_features(p_user_id);
$$;

grant execute on function public.get_user_features(uuid) to authenticated;
grant execute on function public.get_user_hubs(uuid) to authenticated;
