-- Pay first, account after (Nov 12, 2026). A founder who picks Basic or
-- Professional on /start pays through Lemon Squeezy before any login exists.
-- This table holds that payment until they create their login on /start/paid:
-- the entered email and plan, the billing terms they accepted, and what the
-- payment webhook reports. When the login is created the paid plan is applied
-- to the new account and the row is marked claimed.
--
-- Service role only: RLS on, no policies, so no browser client can read or
-- write it. Every access goes through /api/billing/guest-checkout, the payment
-- webhook and /api/start/paid.

create table if not exists public.paid_signups (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  email text not null,
  plan_type text not null check (plan_type in ('founder_basic', 'founder_professional')),
  full_name text,
  company text,
  lead_id uuid,
  consent_accepted_at timestamptz not null,
  consent_policy_version text,
  consent_user_agent text,
  status text not null default 'checkout_started' check (status in ('checkout_started', 'paid', 'claimed')),
  paid_at timestamptz,
  paid_email text,
  ls_subscription_id text,
  ls_customer_id text,
  ls_variant_id text,
  ls_status text,
  current_period_end timestamptz,
  grace_period_ends_at timestamptz,
  cancel_at_period_end boolean not null default false,
  login_email_sent_at timestamptz,
  claimed_at timestamptz,
  claimed_profile_id uuid
);

alter table public.paid_signups enable row level security;

create unique index if not exists paid_signups_ls_subscription_idx
  on public.paid_signups (ls_subscription_id) where ls_subscription_id is not null;
create index if not exists paid_signups_email_idx on public.paid_signups (lower(email), created_at desc);
