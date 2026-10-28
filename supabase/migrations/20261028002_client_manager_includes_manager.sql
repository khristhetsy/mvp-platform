-- Client Manager ranks above Manager, so it should hold everything a Manager holds.
-- It was seeded narrower (20261027002) and was missing seven Manager permissions. This
-- adds them. Additive and idempotent. Rollback: delete these seven grants for the
-- client_manager role.
begin;

insert into public.internal_role_permissions (role_id, permission_id, granted)
select r.id, p.id, true
from public.internal_roles r
join public.internal_permissions p on p.slug in (
  'approve_marketplace',
  'manage_compliance',
  'manage_events',
  'manage_reports',
  'manage_spvs',
  'view_analytics',
  'view_insights'
)
where r.slug = 'client_manager'
on conflict do nothing;

commit;
