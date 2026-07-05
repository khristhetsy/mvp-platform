-- Security Advisor fix — the CRM/voice pipeline views were created as plain views,
-- so Postgres runs them with the owner's privileges (bypassing RLS) and Supabase
-- flags them as "Security Definer View". These views are internal / admin-only and
-- are only read server-side with the service-role client.
--
-- 1) security_invoker = on → the view executes with the *caller's* permissions and
--    honors RLS on the underlying tables (PG15+ / Supabase). Service-role reads
--    (server code) bypass RLS as before, so admin functionality is unaffected.
-- 2) Revoke public-API access as defense-in-depth: anon/authenticated can't query
--    these internal views over PostgREST at all.

alter view public.v_call_queue   set (security_invoker = on);
alter view public.contact_sides  set (security_invoker = on);
alter view public.lead_segments  set (security_invoker = on);
alter view public.hot_queue      set (security_invoker = on);

revoke all on public.v_call_queue,  public.contact_sides,
              public.lead_segments, public.hot_queue
  from anon, authenticated;
