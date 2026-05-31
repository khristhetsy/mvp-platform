-- SPV operational readiness status (automation labels, not legal status).

alter table public.spv_opportunities
  add column if not exists operational_readiness_status text,
  add column if not exists target_amount_reached_notified boolean not null default false;
