-- Pay first checkout moves from Lemon Squeezy to Stripe (Nov 20, 2026).
-- A guest's payment is now recorded with Stripe ids. The ls_status column keeps
-- holding the mapped subscription status for both providers.
--
-- Columns only. paid_signups already has row level security on and no policies,
-- so it stays reachable by the service role alone. No role gains or loses access.

alter table public.paid_signups
  add column if not exists stripe_subscription_id text,
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_price_id text;

create unique index if not exists paid_signups_stripe_subscription_idx
  on public.paid_signups (stripe_subscription_id) where stripe_subscription_id is not null;
