-- Allow logging investor company report views in CRM activity.

alter table public.investor_activity drop constraint if exists investor_activity_activity_type_check;

alter table public.investor_activity add constraint investor_activity_activity_type_check check (
  activity_type in (
    'saved_deal',
    'expressed_interest',
    'requested_intro',
    'follow_up_requested',
    'pledge_amount_submitted',
    'message_thread_created',
    'message_sent',
    'meeting_requested',
    'meeting_accepted',
    'meeting_declined',
    'report_viewed'
  )
) NOT VALID;
