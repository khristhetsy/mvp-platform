-- View/Act split for the admin dashboard's Operational Priorities card.
-- `view_actions` (already exists) lets a user SEE the priorities list.
-- `manage_actions` (new) lets a user ACT on them (complete/dismiss/snooze/escalate).
--
-- To preserve current behavior, grant manage_actions to every role that can
-- already act today (mirrors the view_actions grants from 0069). Legacy staff
-- (admin/analyst profiles without an RBAC row) receive it automatically via the
-- internal_user_has_permission fallback, and super_admins always have every
-- permission. After this runs, action buttons only disappear when someone is
-- explicitly revoked manage_actions on /admin/users/permissions.

-- 1. Insert the new permission (idempotent)
insert into public.internal_permissions (slug, label, description)
values
  ('manage_actions', 'Act on Operational Priorities', 'Complete, dismiss, snooze, or escalate next-best actions')
on conflict (slug) do nothing;

-- 2. Grant manage_actions to every role that currently holds view_actions,
--    so no one loses the ability to act on the dashboard.
insert into public.internal_role_permissions (role_id, permission_id, granted)
select rp.role_id, mp.id, true
from public.internal_role_permissions rp
join public.internal_permissions vp on vp.id = rp.permission_id and vp.slug = 'view_actions'
cross join public.internal_permissions mp
where mp.slug = 'manage_actions'
  and rp.granted = true
on conflict do nothing;

-- 3. Belt-and-suspenders: ensure super_admin and admin explicitly hold it.
insert into public.internal_role_permissions (role_id, permission_id, granted)
select r.id, p.id, true
from public.internal_roles r
join public.internal_permissions p on p.slug = 'manage_actions'
where r.slug in ('super_admin', 'admin')
on conflict do nothing;
