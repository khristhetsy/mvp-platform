-- AI Agent without a company yet: an admin can start an agent and link a company later.
-- UNIQUE (organization_id) stays; Postgres allows many NULLs under a unique constraint.
alter table public.ir_agents alter column organization_id drop not null;
