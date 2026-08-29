-- RBAC permission for act-on-behalf: lets a staff member operate a founder's
-- screens and edit on their behalf, and (later) be assigned founder support.
--
-- Intentionally GATED: unlike most permissions, this is NOT auto-granted to
-- legacy staff (the app excludes it from LEGACY_STAFF_PERMISSIONS). It is granted
-- explicitly here to super_admin only; grant it to specific admins/managers via
-- /admin/users/permissions. Additive + idempotent.

-- 1. Register the permission.
insert into public.internal_permissions (slug, label, description)
values
  ('act_on_behalf', 'Act on Behalf of a Founder', 'Operate a founder''s screens and edit on their behalf; be assigned founder support')
on conflict (slug) do nothing;

-- 2. Grant to super_admin explicitly (super admins already hold every permission
--    in code; this keeps the table consistent). Deliberately NOT granted to the
--    admin/manager roles by default — assign it per person in the permissions UI.
insert into public.internal_role_permissions (role_id, permission_id, granted)
select r.id, p.id, true
from public.internal_roles r
join public.internal_permissions p on p.slug = 'act_on_behalf'
where r.slug = 'super_admin'
on conflict do nothing;
