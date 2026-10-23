-- Audit fix: these functions are SECURITY DEFINER and were callable by any
-- signed-in user through /rest/v1/rpc. They are only ever called with the
-- service role from server code (src/lib/voice/gate.ts, src/lib/learning/progress.ts),
-- so client access is removed.
revoke execute on function public.pre_dial_gate(text) from public, anon, authenticated;
revoke execute on function public.learning_leaderboard_stats() from public, anon, authenticated;
revoke execute on function public.learning_company_last_activity() from public, anon, authenticated;
revoke execute on function public.learning_module_engagement_counts() from public, anon, authenticated;

grant execute on function public.pre_dial_gate(text) to service_role;
grant execute on function public.learning_leaderboard_stats() to service_role;
grant execute on function public.learning_company_last_activity() to service_role;
grant execute on function public.learning_module_engagement_counts() to service_role;
