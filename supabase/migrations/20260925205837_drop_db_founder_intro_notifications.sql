-- Applied to production directly on 2026-09-25 and recorded in migration history
-- as version 20260925205837. This file is the exact SQL production ran, taken from
-- supabase_migrations.schema_migrations.statements, so the repo and history match.

-- Founder notifications for intro decisions now come from the app
-- (api/admin/intro-requests/[id]), which respects notification preferences.
drop trigger if exists trg_notify_founder_intro_status on public.intro_requests;
drop function if exists public.notify_founder_intro_status();
