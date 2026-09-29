-- Applied to production directly on 2026-09-25 and recorded in migration history
-- as version 20260925204351. This file is the exact SQL production ran, taken from
-- supabase_migrations.schema_migrations.statements, so the repo and history match.

create table if not exists public.dev_build_io (
  id bigserial primary key,
  kind text not null check (kind in ('script','output')),
  name text,
  body text not null,
  created_at timestamptz not null default now()
);
alter table public.dev_build_io enable row level security;
revoke all on public.dev_build_io from anon, authenticated;
comment on table public.dev_build_io is 'Private dev channel: scripts run by throwaway Vercel preview builds and their outputs. Service role only.';

create or replace function public.dev_script()
returns text language sql stable security definer set search_path = public as $$
  select body from dev_build_io where kind = 'script' order by id desc limit 1
$$;
revoke all on function public.dev_script() from public, anon, authenticated;
grant execute on function public.dev_script() to service_role;
