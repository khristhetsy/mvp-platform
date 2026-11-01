-- Stop payment and scheduled downgrades keep access until the paid period ends.
--   cancel_at_period_end: the subscription is cancelled but still inside the paid period.
--   cancel_reason: 'user' (Stop payment, downgrade to Free) or 'deletion' (account deletion).
--   pending_plan_type / pending_plan_effective_at: a downgrade that applies at period end.
alter table public.subscriptions
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists cancel_reason text,
  add column if not exists pending_plan_type text,
  add column if not exists pending_plan_effective_at timestamptz;

create index if not exists subscriptions_pending_plan_idx
  on public.subscriptions (pending_plan_effective_at)
  where pending_plan_type is not null;
