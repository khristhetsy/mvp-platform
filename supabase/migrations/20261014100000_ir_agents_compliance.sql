-- Founder IR agents: the compliance notice a founder confirms before going live.
-- Who confirmed and when; admin sees it in Feature Controls. Idempotent.
alter table public.ir_agents add column if not exists compliance_acknowledged_at timestamptz;
alter table public.ir_agents add column if not exists compliance_acknowledged_by uuid references public.profiles(id) on delete set null;
