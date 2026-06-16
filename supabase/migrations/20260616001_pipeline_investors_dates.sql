-- Add source tracking and date fields to pipeline_investors
alter table public.pipeline_investors
  add column if not exists source text not null default 'manual'
    check (source in ('manual', 'platform_match')),
  add column if not exists platform_investor_id uuid,
  add column if not exists last_contact_date date,
  add column if not exists next_follow_up_date date;

comment on column public.pipeline_investors.source is 'manual = founder added; platform_match = imported from CapitalOS matching engine';
comment on column public.pipeline_investors.platform_investor_id is 'profile_id of the matched platform investor (if source = platform_match)';
comment on column public.pipeline_investors.last_contact_date is 'Date of most recent outreach or contact';
comment on column public.pipeline_investors.next_follow_up_date is 'Scheduled follow-up date';
