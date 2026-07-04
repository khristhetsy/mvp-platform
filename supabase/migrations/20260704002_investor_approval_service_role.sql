-- Fix: investor approve/reject/request-changes silently reverted.
--
-- investor_profiles_guard_approval_fields() (from 0056) blocks non-staff from
-- mutating review fields, deciding "staff" via is_staff() → auth.uid(). The admin
-- review API writes with the SERVICE ROLE client (no auth.uid()), so is_staff()
-- returned false and the trigger reverted approval_status back to 'submitted'
-- while letting updated_at through. Result: decisions never persisted.
--
-- The service-role connection is only used in trusted server code behind
-- requireStaffApi(), so treat it as authorized here. We detect it via the
-- request JWT role claim, which PostgREST sets per request and which is NOT
-- affected by SECURITY DEFINER role switching.

create or replace function public.investor_profiles_guard_approval_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  jwt_role text;
begin
  jwt_role := coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    ''
  );

  -- Trusted contexts (authenticated staff session OR service-role API) may set
  -- review fields directly.
  if public.is_staff() or jwt_role = 'service_role' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.approval_status := 'draft';
    new.admin_feedback := null;
    new.submitted_at := null;
    new.approved_at := null;
    new.approved_by := null;
    return new;
  end if;

  if new.approval_status in ('approved', 'rejected', 'changes_requested') then
    new.approval_status := old.approval_status;
  elsif new.approval_status = 'submitted'
    and old.approval_status not in ('draft', 'rejected', 'changes_requested') then
    new.approval_status := old.approval_status;
  end if;

  new.approved_at := old.approved_at;
  new.approved_by := old.approved_by;

  if new.approval_status = 'submitted' and old.approval_status in ('draft', 'rejected', 'changes_requested') then
    new.submitted_at := coalesce(new.submitted_at, now());
  elsif new.approval_status is distinct from old.approval_status then
    new.submitted_at := old.submitted_at;
    new.admin_feedback := old.admin_feedback;
  elsif new.approval_status <> 'submitted' then
    new.admin_feedback := old.admin_feedback;
  end if;

  return new;
end;
$$;
