create table if not exists public._bookings_source_backup_20261018 as
  select id, source_tag, source_confidence, source_set_by, source_set_at
  from public.scheduling_bookings;
alter table public._bookings_source_backup_20261018 enable row level security;
revoke all on table public._bookings_source_backup_20261018 from anon, authenticated;

alter table public.scheduling_bookings
  drop constraint if exists scheduling_bookings_source_confidence_check;
alter table public.scheduling_bookings
  add constraint scheduling_bookings_source_confidence_check
  check (source_confidence is null or source_confidence = any (array['fit','link','cookie','self_reported','manual','inferred']));

update public.scheduling_bookings b
  set source_tag = 'email',
      source_confidence = 'inferred',
      source_set_at = now()
  where b.source_tag is null
    and exists (
      select 1 from public.marketing_events e
      where lower(e.email) = lower(b.booker_email)
        and e.event_type = 'sent'
        and e.occurred_at < b.created_at
    );
