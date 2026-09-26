-- Applied to production directly on 2026-09-25 and recorded in migration history
-- as version 20260925202106. This file is the exact SQL production ran, taken from
-- supabase_migrations.schema_migrations.statements, so the repo and history match.

drop trigger if exists trg_enforce_founder_intro_quota on public.intro_requests;
drop function if exists public.enforce_founder_intro_quota();
drop function if exists public.founder_intro_quota(uuid);
delete from public.platform_settings where key = 'intro_request_limits';
