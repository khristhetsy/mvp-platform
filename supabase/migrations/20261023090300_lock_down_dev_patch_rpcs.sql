-- Audit fix: the patch queue functions were callable by anyone holding the public
-- anon key, protected only by one key hash. The apply-patch-queue workflow calls
-- them with the SB_SERVICE_KEY secret, so client roles do not need access.
--
-- BEFORE APPLYING: confirm the GitHub secret SB_SERVICE_KEY holds the Supabase
-- service role key (not the anon key). If it holds the anon key, the workflow
-- stops working after this migration until the secret is replaced.
revoke execute on function public.dev_patch_pending(text) from public, anon, authenticated;
revoke execute on function public.dev_patch_report(text, bigint, text, text, text) from public, anon, authenticated;
revoke execute on function public.dev_patch_key_ok(text) from public, anon, authenticated;

grant execute on function public.dev_patch_pending(text) to service_role;
grant execute on function public.dev_patch_report(text, bigint, text, text, text) to service_role;
grant execute on function public.dev_patch_key_ok(text) to service_role;
