-- Premium by card, pay first. The Services Agreement is accepted on the payment step,
-- before any account exists, so it is kept on the paid signup and recorded in
-- premium_agreement_acceptances when the login is created.
-- Column only. paid_signups already has row level security on and no policies,
-- so only the service role reads or writes it. No role gains or loses access.
alter table public.paid_signups
  add column if not exists premium_agreement jsonb;
