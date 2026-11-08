-- Private Market emailer: three more investor emails next to the founder and
-- investor weekly emails: New company listed, Introduction update, Monthly
-- market recap. The audience column keeps holding the email version key, so the
-- same settings, schedule and send log serve all five.
alter table public.private_market_weekly_emails drop constraint if exists private_market_weekly_emails_audience_check;
alter table public.private_market_weekly_emails
  add constraint private_market_weekly_emails_audience_check
  check (audience in ('founder', 'investor', 'listed', 'intros', 'monthly'));

alter table public.private_market_weekly_sends drop constraint if exists private_market_weekly_sends_audience_check;
alter table public.private_market_weekly_sends
  add constraint private_market_weekly_sends_audience_check
  check (audience in ('founder', 'investor', 'listed', 'intros', 'monthly'));
