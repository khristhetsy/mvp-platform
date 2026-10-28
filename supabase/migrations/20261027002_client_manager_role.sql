-- Client Manager: iCFO staff who fully manage founder accounts (Done for you clients).
-- Ranks between Manager (20) and Admin (30). Can act on behalf of any founder and run
-- the account; no billing, users, roles, settings, accounts or integrations.
-- Additive and idempotent. Rollback: reassign anyone holding the role, then delete the
-- internal_roles row with slug 'client_manager' (its grants are removed with it).
begin;

insert into public.internal_roles (slug, label, description, rank)
values ('client_manager', 'Client Manager', 'Fully manages founder accounts for Done for you clients. No billing or admin controls.', 25)
on conflict (slug) do nothing;

insert into public.internal_role_permissions (role_id, permission_id, granted)
select r.id, p.id, true
from public.internal_roles r
join public.internal_permissions p on p.slug in (
  'view_admin_dashboard',
  'view_actions',
  'manage_actions',
  'manage_companies',
  'manage_investors',
  'manage_deal_rooms',
  'manage_crm',
  'manage_matching',
  'manage_learning',
  'manage_diligence',
  'review_documents',
  'view_events',
  'act_on_behalf'
)
where r.slug = 'client_manager'
on conflict do nothing;

commit;
