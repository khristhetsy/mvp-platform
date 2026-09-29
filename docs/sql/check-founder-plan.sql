-- Why does a founder who paid at signup show as "Free"?
--
-- Read-only. Run in the Supabase SQL editor on production.
-- Replace the email if you want to check a different account.

-- 1. The row behind the chip.
--    Signature to look for: plan_type = 'founder_free' while subscription_status
--    = 'active' and ls_subscription_id IS NOT NULL. That combination means
--    LemonSqueezy did charge them, the webhook did arrive, but it could not
--    resolve which plan the variant maps to — and the webhook deliberately
--    writes `plan_type: plan ?? undefined`, i.e. it leaves the old plan in place
--    rather than nulling a plan someone is paying for. The account then keeps
--    reading as free forever.
select p.email,
       s.plan_type,
       s.subscription_status,
       s.is_grandfathered,
       s.monthly_price_cents,
       s.ls_subscription_id,
       s.ls_variant_id,
       s.current_period_end,
       s.created_at,
       s.updated_at
  from public.profiles p
  left join public.subscriptions s on s.profile_id = p.id
 where p.email = 'vincent.n2013@gmail.com';

-- 2. Is this one account or a pattern? Every founder whose status says they are
--    paying while their plan says they are not.
select p.email,
       s.plan_type,
       s.subscription_status,
       s.ls_variant_id,
       s.updated_at
  from public.subscriptions s
  join public.profiles p on p.id = s.profile_id
 where s.plan_type in ('founder_free', 'founder_trial')
   and (s.subscription_status = 'active' or s.ls_subscription_id is not null)
 order by s.updated_at desc;

-- 3. Which variant ids are actually arriving from LemonSqueezy. Compare these
--    against LEMONSQUEEZY_VARIANT_ID_BASIC / _PROFESSIONAL in the Vercel env.
--    A variant id here that matches neither is the resolution failure above.
select ls_variant_id,
       count(*)                                as accounts,
       min(updated_at)                         as first_seen,
       max(updated_at)                         as last_seen,
       array_agg(distinct plan_type)           as plans_recorded
  from public.subscriptions
 where ls_variant_id is not null
 group by ls_variant_id
 order by last_seen desc;
