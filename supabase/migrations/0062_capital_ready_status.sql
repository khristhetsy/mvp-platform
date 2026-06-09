-- Capital Ready milestone and learning readiness score bonus tracking.

alter table public.companies
  add column if not exists capital_ready_at timestamptz,
  add column if not exists learning_readiness_bonus integer not null default 0
    check (learning_readiness_bonus >= 0 and learning_readiness_bonus <= 100);

insert into public.learning_badges (name, description, icon_name, criteria_type, criteria_value)
select
  'Capital Ready',
  'Completed foundation through engagement learning stages — ready for institutional capital conversations.',
  'capital-ready',
  'modules_completed',
  999
where not exists (
  select 1 from public.learning_badges existing where existing.icon_name = 'capital-ready'
);
