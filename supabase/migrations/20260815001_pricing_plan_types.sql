-- New pricing model: add founder_free + founder_managed_ir plan types and retire
-- the 3-day trial. Widen the plan_type check constraint (the old one rejected the
-- new tiers, which also blocked new founder signups that default to founder_free),
-- then convert any legacy founder_trial rows into permanent Free (no expiration).

alter table public.subscriptions drop constraint if exists subscriptions_plan_type_check;

alter table public.subscriptions add constraint subscriptions_plan_type_check
  check (plan_type in (
    'founder_free',
    'founder_trial',
    'founder_basic',
    'founder_professional',
    'founder_managed_ir',
    'investor_free',
    'investor_pro',
    'investor_premium',
    'admin_internal'
  ));

-- Grandfather existing trials into permanent Free (all tools, no trial countdown).
update public.subscriptions
set plan_type            = 'founder_free',
    subscription_status  = 'free',
    trial_started_at     = null,
    trial_ends_at        = null,
    current_period_start = null,
    current_period_end   = null,
    monthly_price_cents  = 0,
    updated_at           = now()
where plan_type = 'founder_trial';
