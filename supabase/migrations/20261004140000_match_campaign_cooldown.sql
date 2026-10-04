-- Match campaigns: cooldown between campaigns (Oct 4, 2026).
--
-- Additive. A founder who got a real email from another Match campaign within
-- the campaign's cooldown_days (match_config, default 30) is held back with the
-- new reason 'emailed_recently'. excluded_note carries the detail shown to
-- admin, e.g. 'Emailed Sep 30 by "Your investor matches"'.

alter table public.match_campaign_founders
  add column if not exists excluded_note text;

alter table public.match_campaign_founders
  drop constraint if exists match_campaign_founders_excluded_reason_check;
alter table public.match_campaign_founders
  add constraint match_campaign_founders_excluded_reason_check check (excluded_reason in (
    'missing_industry', 'missing_stage', 'unconfirmed_data', 'no_email', 'invalid_email',
    'email_unverified', 'suppressed', 'eu_excluded', 'emailed_recently', 'no_matches'));

-- The cooldown looks up other campaigns' rows for the same founder contact.
create index if not exists match_campaign_founders_contact_sent_idx
  on public.match_campaign_founders (founder_contact_id, sent_at)
  where send_status = 'sent';
