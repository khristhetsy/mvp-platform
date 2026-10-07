-- Resend sends every event to /api/marketing/webhook. Events for non-marketing sends
-- (investor intros, outreach, tests) land in marketing_webhook_log as outcome 'no_match'
-- with the Resend id in detail. Copy them onto email_log and outreach recipient rows.
create or replace function public.apply_resend_event_to_email_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rid text;
  col text;
  rec record;
begin
  if not new.verified or new.outcome <> 'no_match' or new.detail is null then
    return new;
  end if;
  rid := substring(new.detail from 'resend_id ([0-9a-fA-F-]{20,})');
  if rid is null then
    return new;
  end if;
  col := case new.event_type
    when 'delivered' then 'delivered_at'
    when 'opened' then 'opened_at'
    when 'clicked' then 'clicked_at'
    when 'bounced' then 'bounced_at'
    when 'spam_complaint' then 'complained_at'
    else null end;
  update email_log set last_event = new.event_type, last_event_at = new.received_at where provider_id = rid;
  if col is not null then
    execute format('update email_log set %I = $1 where provider_id = $2 and %I is null', col, col)
      using new.received_at, rid;
  end if;
  if new.event_type in ('opened', 'clicked') then
    for rec in select to_email from email_log where provider_id = rid loop
      update investor_outreach_recipients
         set opened_at = coalesce(opened_at, new.received_at),
             clicked_at = case when new.event_type = 'clicked' then coalesce(clicked_at, new.received_at) else clicked_at end
       where lower(email) = lower(rec.to_email) and sent_at is not null and sent_at <= new.received_at;
      update founder_manual_outreach_recipients
         set opened_at = coalesce(opened_at, new.received_at),
             clicked_at = case when new.event_type = 'clicked' then coalesce(clicked_at, new.received_at) else clicked_at end
       where lower(email) = lower(rec.to_email) and last_sent_at is not null and last_sent_at <= new.received_at;
    end loop;
  end if;
  return new;
exception when others then
  return new;
end;
$$;

drop trigger if exists trg_apply_resend_event_to_email_log on public.marketing_webhook_log;
create trigger trg_apply_resend_event_to_email_log
after insert on public.marketing_webhook_log
for each row execute function public.apply_resend_event_to_email_log();
