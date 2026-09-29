-- Applied to production directly on 2026-09-24 and recorded in migration history
-- as version 20260924162700. This file is the exact SQL production ran, taken from
-- supabase_migrations.schema_migrations.statements, so the repo and history match.

alter view public.v_ceo_kpi_meeting_weekly set (security_invoker = true);
alter view public.v_ceo_kpi_meeting_monthly set (security_invoker = true);
alter view public.v_ceo_kpi_meeting_quarterly set (security_invoker = true);
alter view public.v_ceo_kpi_meeting_ytd set (security_invoker = true);
