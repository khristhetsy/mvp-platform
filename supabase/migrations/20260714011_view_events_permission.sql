-- View/Edit split for the Events area.
-- `manage_events` (already exists) lets a user EDIT events (event details, sessions,
-- sponsors, banner, moderators). `view_events` (new) lets a user OPEN the Events area
-- and see events read-only.
--
-- To preserve current behavior, grant view_events to every role that already holds
-- manage_events, so today's editors keep their access and also gain view. Legacy staff
-- (admin/analyst without an RBAC row) get it automatically via the fallback, and
-- super_admins always have every permission. View-only access for other roles/users is
-- granted from /admin/feature-controls and /admin/users/permissions.

-- 1. Insert the new permission (idempotent)
insert into public.internal_permissions (slug, label, description)
values
  ('view_events', 'View Events', 'Open the Events area and view events read-only')
on conflict (slug) do nothing;

-- 2. Grant view_events to every role that currently holds manage_events.
insert into public.internal_role_permissions (role_id, permission_id, granted)
select rp.role_id, vp.id, true
from public.internal_role_permissions rp
join public.internal_permissions mp on mp.id = rp.permission_id and mp.slug = 'manage_events'
cross join public.internal_permissions vp
where vp.slug = 'view_events'
  and rp.granted = true
on conflict do nothing;

-- 3. Belt-and-suspenders: ensure super_admin, admin, and manager explicitly hold it.
insert into public.internal_role_permissions (role_id, permission_id, granted)
select r.id, p.id, true
from public.internal_roles r
join public.internal_permissions p on p.slug = 'view_events'
where r.slug in ('super_admin', 'admin', 'manager')
on conflict do nothing;
