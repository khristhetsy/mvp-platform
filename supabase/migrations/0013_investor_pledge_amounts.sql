-- Investor pledge amounts (non-binding pledges, not committed investment).

alter table public.investor_interests
  add column if not exists pledge_amount numeric(14, 2),
  add column if not exists pledge_currency text not null default 'USD',
  add column if not exists pledge_amount_updated_at timestamptz;

create index if not exists investor_interests_pledge_amount_idx
  on public.investor_interests (company_id)
  where pledge_amount is not null;

-- Allow pledge_amount_submitted in CRM activity log.
alter table public.investor_activity drop constraint if exists investor_activity_activity_type_check;

alter table public.investor_activity add constraint investor_activity_activity_type_check check (
  activity_type in (
    'saved_deal',
    'expressed_interest',
    'requested_intro',
    'follow_up_requested',
    'pledge_amount_submitted'
  )
) NOT VALID;
