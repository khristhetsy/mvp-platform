-- Expand the admin Investor Relations pipeline from 3 stages to a 5-stage funnel.
-- Old: interested | meeting_requested | follow_up
-- New: prospect | outreach | engaged | diligence | committed
-- Semantic remap of existing rows: interested→engaged, meeting_requested→diligence,
-- follow_up→engaged. Then swap the CHECK constraint and default. Founder-owned
-- pipeline_investors (separate model) is untouched.

alter table public.investor_pipeline
  drop constraint if exists investor_pipeline_stage_check;

-- Drop default so the temporary values aren't rejected mid-migration.
alter table public.investor_pipeline
  alter column stage drop default;

update public.investor_pipeline set stage = 'engaged'   where stage = 'interested';
update public.investor_pipeline set stage = 'diligence'  where stage = 'meeting_requested';
update public.investor_pipeline set stage = 'engaged'   where stage = 'follow_up';

-- Any unexpected legacy value falls back to the funnel entry point.
update public.investor_pipeline
  set stage = 'prospect'
  where stage not in ('prospect','outreach','engaged','diligence','committed');

alter table public.investor_pipeline
  alter column stage set default 'prospect';

alter table public.investor_pipeline
  add constraint investor_pipeline_stage_check
  check (stage in ('prospect','outreach','engaged','diligence','committed'));
