-- Discontinue the free founder plan for new signups; keep existing accounts on it.
--
-- Until now "Free (grandfathered)" was only a display label — no flag, no date
-- check. Every free account claimed to be grandfathered, including ones created
-- after the $49 Basic plan launched. This makes the status a real, stored fact
-- so it can be read, granted and revoked rather than inferred on every read.
--
-- Cutoff: 2026-09-16, the day founder_basic shipped at $49 (commit 5786f92).
-- Accounts created between then and today are ALSO grandfathered: they were
-- granted free because a revert (b7ae05b) had put the free tier back, which was
-- our error, not theirs. Revoke individually from admin billing if needed.

alter table public.subscriptions
  add column if not exists is_grandfathered boolean not null default false;

comment on column public.subscriptions.is_grandfathered is
  'True when this account keeps free access after the plan was discontinued. Set once by backfill; grantable/revocable by staff. Never inferred from a date at read time.';

-- Backfill: every founder currently on a free plan keeps it.
update public.subscriptions
   set is_grandfathered = true
 where plan_type in ('founder_free', 'founder_trial')
   and is_grandfathered = false;

-- Finding free accounts is a routine admin filter; keep it cheap.
create index if not exists subscriptions_grandfathered_idx
  on public.subscriptions (is_grandfathered)
  where is_grandfathered = true;

-- The original CHECK predates founder_free / founder_managed_ir / investor_pro /
-- investor_premium, so rows using them were only ever insertable because the
-- constraint was dropped or never enforced. Restate it against the real plan set.
alter table public.subscriptions
  drop constraint if exists subscriptions_plan_type_check;

alter table public.subscriptions
  add constraint subscriptions_plan_type_check check (
    plan_type in (
      'founder_free',
      'founder_trial',
      'founder_basic',
      'founder_professional',
      'founder_managed_ir',
      'investor_free',
      'investor_pro',
      'investor_premium',
      'admin_internal'
    )
  );

-- New founders land here until checkout completes, so 'pending_payment' has to
-- be a legal status.
alter table public.subscriptions
  drop constraint if exists subscriptions_subscription_status_check;

alter table public.subscriptions
  add constraint subscriptions_subscription_status_check check (
    subscription_status in (
      'trialing', 'active', 'expired', 'canceled', 'free', 'internal', 'pending_payment'
    )
  );
