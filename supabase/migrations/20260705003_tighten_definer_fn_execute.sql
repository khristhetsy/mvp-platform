-- Security Advisor (optional) — "Public Can Execute SECURITY DEFINER Function".
-- These helpers only return a boolean about the *current caller* (staff? released?
-- engagement role?), so they don't leak data. But best practice is to not grant
-- EXECUTE to PUBLIC. They're used inside RLS policies, so grant to authenticated
-- (and service_role) which is who actually evaluates those policies.
--
-- Safe because no anon/public-facing table's RLS policy calls these functions.
-- If a logged-out page ever errors after this, grant that one function back to anon.

do $$
declare
  fn text;
  sigs text[] := array[
    'public.is_admin()',
    'public.is_staff()',
    'public.company_is_approved(uuid)',
    'public.dd_is_admin(uuid)',
    'public.dd_member_role(uuid)',
    'public.dd_gate_on(uuid, text, text)',
    'public.dd_is_released(uuid)'
  ];
begin
  foreach fn in array sigs loop
    -- skip any that don't exist in this environment
    begin
      execute format('revoke execute on function %s from public', fn);
      execute format('grant execute on function %s to authenticated, service_role', fn);
    exception when undefined_function then
      raise notice 'skipping missing function %', fn;
    end;
  end loop;
end $$;
