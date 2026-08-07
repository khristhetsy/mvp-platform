-- Kanban stage for the founder Investor CRM board view.
-- Additive + idempotent — safe to apply on staging first, then production.

alter table public.pipeline_investors
  add column if not exists pipeline_stage text not null default 'new'
    check (pipeline_stage in ('new', 'contacted', 'interested', 'meeting', 'committed', 'passed'));

-- Backfill each row's stage from its existing signal columns (highest-signal
-- stage wins). Only touches rows still at the default so re-running is safe.
update public.pipeline_investors set pipeline_stage = case
  when pledge_amount is not null and pledge_amount > 0 then 'committed'
  when meeting_requested in ('requested', 'scheduled')  then 'meeting'
  when interested = true                                 then 'interested'
  when outreach_status = 'closed'                        then 'passed'
  when outreach_status in ('contacted', 'in_progress')  then 'contacted'
  else 'new'
end
where pipeline_stage = 'new';

create index if not exists pipeline_investors_stage_idx
  on public.pipeline_investors (founder_id, pipeline_stage);

comment on column public.pipeline_investors.pipeline_stage is
  'Kanban stage for the founder Investor CRM board: new, contacted, interested, meeting, committed, passed.';
