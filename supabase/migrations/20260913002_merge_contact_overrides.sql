-- Atomic patch for crm_contacts.overrides.
--
-- Every writer of overrides did the same thing in application code: SELECT the column,
-- spread a patch over it in JavaScript, UPDATE the whole column back. Two of those
-- running at once - the 4-hourly derivation cron and a staff member clicking Approve on
-- the same contact - interleave as: A reads, B reads, A writes, B writes A's changes
-- away. The lost update is silent, and the loser still reports success.
--
-- This function does the merge INSIDE Postgres in one statement, so it is atomic per row:
--   overrides := (coalesce(overrides, '{}') || p_patch) - p_remove
-- Concurrent callers serialise on the row lock and both patches land.
--
-- p_remove exists for clearing provenance tags (a human edit makes a derived value theirs)
-- and for undo, which must delete a key rather than set it to null.

create or replace function public.merge_contact_overrides(
  p_id     uuid,
  p_patch  jsonb   default '{}'::jsonb,
  p_remove text[]  default '{}'::text[]
) returns jsonb
language sql
security definer
set search_path = public
as $$
  update public.crm_contacts
     set overrides = (coalesce(overrides, '{}'::jsonb) || coalesce(p_patch, '{}'::jsonb)) - coalesce(p_remove, '{}'::text[])
   where id = p_id
   returning overrides;
$$;

-- Service-role only: this bypasses RLS by design (security definer) and must not be
-- reachable from the anon/authenticated API roles.
revoke all on function public.merge_contact_overrides(uuid, jsonb, text[]) from public;
revoke all on function public.merge_contact_overrides(uuid, jsonb, text[]) from anon, authenticated;
grant execute on function public.merge_contact_overrides(uuid, jsonb, text[]) to service_role;
