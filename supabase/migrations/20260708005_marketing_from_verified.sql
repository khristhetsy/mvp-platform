-- Repair the marketing sender to the ONLY verified sending domain: icapos.com.
-- Unverified sender domains (mail.icapos.com, mail.myicfos.com, myicfos.com,
-- resend.dev) make Resend reject every send with "domain not verified" — nothing
-- goes out and nothing can be tracked. This fixes existing campaigns/steps AND the
-- column defaults. reply_to (e.g. admin@myicfos.com) is intentionally left alone —
-- that's a receiving address, not a sender.

update public.marketing_campaigns
  set from_email = 'outreach@icapos.com'
  where from_email is null
     or from_email ilike '%@mail.icapos.com'
     or from_email ilike '%@mail.myicfos.com'
     or from_email ilike '%@myicfos.com'
     or from_email ilike '%@resend.dev';

update public.marketing_sequence_steps
  set from_email = 'outreach@icapos.com'
  where from_email is null
     or from_email ilike '%@mail.icapos.com'
     or from_email ilike '%@mail.myicfos.com'
     or from_email ilike '%@myicfos.com'
     or from_email ilike '%@resend.dev';

alter table public.marketing_campaigns      alter column from_email set default 'outreach@icapos.com';
alter table public.marketing_sequence_steps alter column from_email set default 'outreach@icapos.com';
