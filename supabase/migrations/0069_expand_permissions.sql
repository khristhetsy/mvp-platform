-- Expand internal permissions to cover every admin nav module.
-- Removes reliance on manage_page_builder (deprecated) and adds 17 new slugs.

-- 1. Insert new permissions (idempotent)
insert into public.internal_permissions (slug, label, description)
values
  ('view_actions',           'View Actions',           'Access the admin actions queue'),
  ('manage_spvs',            'Manage SPVs',            'Create and manage SPV workflows'),
  ('manage_deal_rooms',      'Manage Deal Rooms',      'Manage deal room workspaces'),
  ('manage_crm',             'Manage CRM',             'Manage the investor CRM'),
  ('manage_matching',        'Manage Matching',        'Manage founder-investor matching'),
  ('manage_billing',         'Manage Billing',         'View and manage billing records'),
  ('manage_diligence',       'Manage Diligence',       'Manage diligence workflows'),
  ('manage_compliance',      'Manage Compliance',      'Manage compliance events'),
  ('manage_integrations',    'Manage Integrations',    'Configure platform integrations'),
  ('manage_queues',          'Manage Queues',          'Manage background job queues'),
  ('manage_automation',      'Manage Automation',      'Configure workflow automation'),
  ('manage_reports',         'Manage Reports',         'Access and generate reports'),
  ('manage_imports',         'Manage Import / Export', 'Run data imports and exports'),
  ('view_analytics',         'View Analytics',         'View platform analytics'),
  ('view_insights',          'View Insights',          'View platform insights'),
  ('view_system_health',     'View System Health',     'Monitor system health metrics'),
  ('manage_beta_operations', 'Manage Beta Operations', 'Access beta operations tooling')
on conflict (slug) do nothing;

-- 2. Grant ALL new permissions to super_admin
insert into public.internal_role_permissions (role_id, permission_id, granted)
select r.id, p.id, true
from public.internal_roles r
cross join public.internal_permissions p
where r.slug = 'super_admin'
  and p.slug in (
    'view_actions','manage_spvs','manage_deal_rooms','manage_crm','manage_matching',
    'manage_billing','manage_diligence','manage_compliance','manage_integrations',
    'manage_queues','manage_automation','manage_reports','manage_imports',
    'view_analytics','view_insights','view_system_health','manage_beta_operations'
  )
on conflict do nothing;

-- 3. Grant new permissions to admin (all except manage_users / assign_roles which stay super_admin-only)
insert into public.internal_role_permissions (role_id, permission_id, granted)
select r.id, p.id, true
from public.internal_roles r
join public.internal_permissions p on p.slug in (
  'view_actions','manage_spvs','manage_deal_rooms','manage_crm','manage_matching',
  'manage_billing','manage_diligence','manage_compliance','manage_integrations',
  'manage_queues','manage_automation','manage_reports','manage_imports',
  'view_analytics','view_insights','view_system_health','manage_beta_operations'
)
where r.slug = 'admin'
on conflict do nothing;

-- 4. Grant operational subset to manager
insert into public.internal_role_permissions (role_id, permission_id, granted)
select r.id, p.id, true
from public.internal_roles r
join public.internal_permissions p on p.slug in (
  'view_actions','manage_spvs','manage_deal_rooms','manage_crm','manage_matching',
  'manage_diligence','manage_compliance','manage_reports','view_analytics','view_insights'
)
where r.slug = 'manager'
on conflict do nothing;

-- 5. Grant view_actions to regular_user
insert into public.internal_role_permissions (role_id, permission_id, granted)
select r.id, p.id, true
from public.internal_roles r
join public.internal_permissions p on p.slug = 'view_actions'
where r.slug = 'regular_user'
on conflict do nothing;

-- 6. Update legacy staff fallback: drop manage_page_builder from exclusion list.
--    manage_page_builder row stays in DB to avoid FK errors on existing overrides.
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
