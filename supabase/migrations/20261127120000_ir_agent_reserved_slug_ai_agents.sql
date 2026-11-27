-- /ai-agents (the public AI Agents marketing page) is a top level route, so it cannot be a founder company slug.
insert into public.ir_agent_reserved_slugs (slug) values ('ai-agents')
on conflict (slug) do nothing;
