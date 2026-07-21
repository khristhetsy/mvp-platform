-- Bounded grace period for subscriptions whose payment has failed.
--
-- The LemonSqueezy webhook mapped `past_due` straight to `active` with nothing
-- to end it, so a subscriber whose card failed kept full paid access forever —
-- every subsequent past_due event simply rewrote `active` again.
--
-- The webhook now stamps this column when it sees `past_due`, and the access
-- check treats an elapsed grace period as inactive. Null means no grace period
-- applies, which is the normal case for a healthy subscription.

alter table public.subscriptions
  add column if not exists grace_period_ends_at timestamptz;

comment on column public.subscriptions.grace_period_ends_at is
  'When a past_due subscription loses access. Set by the billing webhook; null for healthy subscriptions.';

create index if not exists subscriptions_grace_period_ends_at_idx
  on public.subscriptions (grace_period_ends_at)
  where grace_period_ends_at is not null;
