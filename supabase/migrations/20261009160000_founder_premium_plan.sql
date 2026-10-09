-- Premium founder plan ($1,000/mo, done for you).
-- subscriptions.plan_type is checked against a fixed list; add founder_premium
-- so a Premium checkout can be written. Every existing value is kept.
alter table public.subscriptions
  drop constraint if exists subscriptions_plan_type_check;

alter table public.subscriptions
  add constraint subscriptions_plan_type_check check (
    plan_type in (
      'founder_free',
      'founder_trial',
      'founder_basic',
      'founder_professional',
      'founder_premium',
      'founder_managed_ir',
      'investor_free',
      'investor_pro',
      'investor_premium',
      'admin_internal'
    )
  );
