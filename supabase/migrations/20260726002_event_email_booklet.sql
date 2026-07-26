alter table public.marketing_campaigns
  drop constraint if exists marketing_campaigns_event_email_type_check;

alter table public.marketing_campaigns
  add constraint marketing_campaigns_event_email_type_check
  check (event_email_type in ('invite','reminder','day_of','booklet'));
