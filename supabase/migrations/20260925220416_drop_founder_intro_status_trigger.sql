-- Applied to production directly on 2026-09-25 and recorded in migration history
-- as version 20260925220416. This file is the exact SQL production ran, taken from
-- supabase_migrations.schema_migrations.statements, so the repo and history match.

drop trigger if exists trg_notify_founder_intro_status on public.intro_requests;
drop function if exists public.notify_founder_intro_status();
