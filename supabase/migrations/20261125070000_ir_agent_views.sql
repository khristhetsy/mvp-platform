-- AI Agent views: one row per visitor session that opened a live agent page.
-- Feeds the Traction tab (views, and view to chat rate). Written only by the
-- public view route through the service role; nobody reads it from the browser.
create table if not exists public.ir_agent_views (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.ir_agents(id) on delete cascade,
  session_id text not null,
  source text,
  created_at timestamptz not null default now(),
  unique (agent_id, session_id)
);

create index if not exists ir_agent_views_agent_idx on public.ir_agent_views (agent_id, created_at desc);
create index if not exists ir_agent_views_created_idx on public.ir_agent_views (created_at desc);

-- RLS on with no policies: anon and authenticated users get no access.
-- The service role bypasses RLS, which is the only writer and reader.
alter table public.ir_agent_views enable row level security;
revoke all on public.ir_agent_views from anon, authenticated;
