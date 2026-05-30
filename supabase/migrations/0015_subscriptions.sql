-- Phase 1 subscriptions and entitlements (no payment provider integration).
-- Rollback: drop table public.subscriptions (policies/indexes drop with table). Safe for existing users because profiles/companies are unchanged.

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null,
  plan_type text not null check (
    plan_type in (
      'founder_trial',
      'founder_basic',
      'founder_professional',
      'investor_free',
      'admin_internal'
    )
  ),
  subscription_status text not null check (
    subscription_status in ('trialing', 'active', 'expired', 'canceled', 'free', 'internal')
  ),
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  monthly_price_cents integer not null default 0,
  currency text not null default 'USD',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id)
);

create index if not exists subscriptions_profile_id_idx on public.subscriptions (profile_id);
create index if not exists subscriptions_plan_type_idx on public.subscriptions (plan_type);
create index if not exists subscriptions_status_idx on public.subscriptions (subscription_status);
create index if not exists subscriptions_trial_ends_at_idx on public.subscriptions (trial_ends_at);

alter table public.subscriptions enable row level security;

drop policy if exists "subscriptions_select_own" on public.subscriptions;
create policy "subscriptions_select_own"
  on public.subscriptions for select to authenticated
  using (profile_id = auth.uid());

drop policy if exists "subscriptions_select_staff" on public.subscriptions;
create policy "subscriptions_select_staff"
  on public.subscriptions for select to authenticated
  using (public.is_staff());

-- Backfill existing users without removing access.
insert into public.subscriptions (
  profile_id,
  role,
  plan_type,
  subscription_status,
  current_period_start,
  monthly_price_cents,
  currency
)
select
  p.id,
  lower(p.role),
  case
    when lower(p.role) in ('admin', 'analyst') then 'admin_internal'
    when lower(p.role) = 'investor' then 'investor_free'
    else 'founder_professional'
  end,
  case
    when lower(p.role) in ('admin', 'analyst') then 'internal'
    when lower(p.role) = 'investor' then 'free'
    else 'active'
  end,
  coalesce(p.created_at, now()),
  case
    when lower(p.role) = 'founder' then 100000
    else 0
  end,
  'USD'
from public.profiles p
where not exists (
  select 1 from public.subscriptions s where s.profile_id = p.id
);
