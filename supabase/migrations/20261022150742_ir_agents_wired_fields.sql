-- Founder IR agents: which company profile fields are kept OUT of the agent.
-- Every wired field is on by default; an admin or founder can untick one in the Build tab.
-- Idempotent.
alter table public.ir_agents add column if not exists wired_excluded text[] not null default '{}';
