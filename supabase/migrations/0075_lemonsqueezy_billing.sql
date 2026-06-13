-- Add LemonSqueezy billing columns to subscriptions table.
-- Replaces Stripe as the payment processor. Stripe columns kept for audit.

alter table public.subscriptions
  add column if not exists ls_customer_id    text,
  add column if not exists ls_subscription_id text,
  add column if not exists ls_variant_id      text;

create unique index if not exists subscriptions_ls_customer_idx
  on public.subscriptions (ls_customer_id)
  where ls_customer_id is not null;

create unique index if not exists subscriptions_ls_subscription_idx
  on public.subscriptions (ls_subscription_id)
  where ls_subscription_id is not null;
