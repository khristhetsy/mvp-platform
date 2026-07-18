-- Security (Supabase advisor: CRITICAL "Security Definer View") — all 7 flagged views.
--
-- Each of these is a view in the public schema, so it's reachable via the REST API. As
-- SECURITY DEFINER views they ran with the creator's rights and bypassed row-level
-- security, exposing sensitive aggregates (company MRR, CEO meeting KPIs, contact
-- country counts) to any authenticated API caller.
--
-- Every one of these is read only through the service role server-side:
--   v_sales_forecast_actuals   -> src/lib/forecast/store.ts
--   v_ceo_kpi_meeting_*         -> src/lib/meetings/kpi.ts
--   v_ceo_meeting_readiness     -> (not browser-read)
--   crm_country_facets          -> src/app/api/sales/contacts/facets/route.ts
-- The service role bypasses RLS regardless, so switching to invoker mode subjects API
-- callers to their own RLS (they get nothing) without changing any app behaviour.

alter view public.v_sales_forecast_actuals   set (security_invoker = on);
alter view public.v_ceo_kpi_meeting_weekly    set (security_invoker = on);
alter view public.v_ceo_kpi_meeting_monthly   set (security_invoker = on);
alter view public.v_ceo_kpi_meeting_quarterly set (security_invoker = on);
alter view public.v_ceo_kpi_meeting_ytd       set (security_invoker = on);
alter view public.v_ceo_meeting_readiness     set (security_invoker = on);
alter view public.crm_country_facets          set (security_invoker = on);
