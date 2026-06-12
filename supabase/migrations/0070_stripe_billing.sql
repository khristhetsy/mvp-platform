-- Add Stripe columns + investor paid plan types.
-- Safe to run on existing data — new columns are nullable.

-- 1. Add Stripe customer + subscription IDs to subscriptions table
alter table public.subscriptions
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists stripe_price_id text;

create unique index if not exists subscriptions_stripe_customer_idx
  on public.subscriptions (stripe_customer_id)
  where stripe_customer_id is not null;

create unique index if not exists subscriptions_stripe_subscription_idx
  on public.subscriptions (stripe_subscription_id)
  where stripe_subscription_id is not null;

-- 2. Expand plan_type check to include investor paid plans
alter table public.subscriptions
  drop constraint if exists subscriptions_plan_type_check;

alter table public.subscriptions
  add constraint subscriptions_plan_type_check check (
    plan_type in (
      'founder_trial',
      'founder_basic',
      'founder_professional',
      'investor_free',
      'investor_pro',
      'investor_premium',
      'admin_internal'
    )
  );

-- 3. Update founder_basic monthly price to $500
update public.subscriptions
  set monthly_price_cents = 50000
  where plan_type = 'founder_basic'
    and monthly_price_cents = 49900;
