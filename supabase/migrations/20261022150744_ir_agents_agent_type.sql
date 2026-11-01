-- IR agents: AI Agent Type. Each type loads its own question set.
-- Existing agents keep their questions and become 'founder'. Idempotent.
alter table public.ir_agents add column if not exists agent_type text not null default 'founder';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ir_agents_agent_type_check') then
    alter table public.ir_agents
      add constraint ir_agents_agent_type_check check (agent_type in ('founder', 'investor', 'sales', 'marketing', 'ir'));
  end if;
end $$;
