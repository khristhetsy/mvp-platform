-- Retire free access: paywall the founder tools for NEW free accounts while
-- grandfathering everyone who already has free access.
--
-- grandfathered_free = true  -> keep the pre-paywall free tool access
-- grandfathered_free = false -> tools are locked until a paid plan is chosen
--
-- Backfill marks every EXISTING founder_free row as grandfathered so no current
-- user loses access. New rows default to false; the app stamps the correct value
-- at creation from the profile's age (see ensureSubscriptionForProfile).

alter table public.subscriptions
  add column if not exists grandfathered_free boolean not null default false;

update public.subscriptions
  set grandfathered_free = true
  where plan_type = 'founder_free';
