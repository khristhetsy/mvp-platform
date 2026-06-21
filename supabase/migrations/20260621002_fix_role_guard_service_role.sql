-- Fix: admin role changes (made via the service-role client in
-- /api/admin/users/manage) were being silently reverted by the
-- profiles_guard_role_escalation trigger, because is_staff() checks auth.uid()
-- which is NULL on a service-role connection. Treat service_role as privileged.

create or replace function public.profiles_guard_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_privileged boolean := public.is_staff() or auth.role() = 'service_role';
begin
  if tg_op = 'INSERT' then
    if not is_privileged and lower(coalesce(new.role, '')) not in ('founder', 'investor') then
      new.role := 'founder';
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' and not is_privileged and new.role is distinct from old.role then
    new.role := old.role;
  end if;

  return new;
end;
$$;
