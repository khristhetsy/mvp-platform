-- Applied to production directly on 2026-09-25 and recorded in migration history
-- as version 20260925210150. This file is the exact SQL production ran, taken from
-- supabase_migrations.schema_migrations.statements, so the repo and history match.

create table if not exists public.dev_scripts (id int primary key, body text not null, updated_at timestamptz not null default now());
create table if not exists public.dev_code_dump (id bigserial primary key, run text not null, path text not null, content text, created_at timestamptz not null default now());
alter table public.dev_scripts enable row level security;
alter table public.dev_code_dump enable row level security;
revoke all on public.dev_scripts, public.dev_code_dump from anon, authenticated;
comment on table public.dev_scripts is 'Private: scripts run by preview builds for Claude (read files, verify patches). Service role only.';
comment on table public.dev_code_dump is 'Private: file contents and check results posted by preview builds. Service role only.';
