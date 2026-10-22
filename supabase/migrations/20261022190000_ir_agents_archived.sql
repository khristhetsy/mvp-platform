-- IR agents: archive. An archived agent is offline (never live) and hidden from the default list; restoring clears the date.
alter table public.ir_agents add column if not exists archived_at timestamptz;
