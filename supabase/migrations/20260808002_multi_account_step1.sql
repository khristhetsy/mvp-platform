-- Multi-account / Deal Company — Step 1 (foundation).
-- Additive + idempotent — creates the org model WITHOUT touching existing tables.
-- Steps 2 (backfill) and 3 (per-table org_id retrofit + RLS) follow separately,
-- one verified migration per table. See icapos-multi-account-build-spec.md.

do $$ begin
  if not exists (select 1 from pg_type where typname = 'org_type') then
    create type org_type as enum ('founder', 'spv');
    -- 'spv' is the backend/legal value; the UI label is always "Deal Company".
  end if;
end $$;

create table if not exists public.organizations (
  id                     uuid primary key default gen_random_uuid(),
  name                   text not null,
  type                   org_type not null default 'founder',
  parent_org_id          uuid references public.organizations(id),
  stripe_customer_id     text,
  stripe_subscription_id text,
  billing_status         text not null default 'incomplete',
  -- incomplete | active | past_due | canceled | comped
  tier                   text,          -- 'basic' | 'professional' | null (Deal Company has no tier)
  created_via            text not null default 'signup',   -- signup | admin_direct
  purpose                text,          -- null | 'demo' | 'internal' (admin_direct only, display tag)
  email_dispatch_enabled boolean not null default true,
  created_by             uuid references auth.users(id),
  created_at             timestamptz not null default now()
);

create table if not exists public.memberships (
  user_id    uuid references auth.users(id) on delete cascade,
  org_id     uuid references public.organizations(id) on delete cascade,
  role       text not null default 'owner',   -- owner | admin | member | viewer
  created_at timestamptz not null default now(),
  primary key (user_id, org_id)
);

create table if not exists public.processed_stripe_events (
  event_id     text primary key,
  processed_at timestamptz not null default now()
);

create index if not exists memberships_org_idx on public.memberships(org_id);
create unique index if not exists organizations_stripe_sub_idx
  on public.organizations(stripe_subscription_id)
  where stripe_subscription_id is not null;

-- Membership check used by every org-scoped RLS policy (security definer so the
-- policy can read memberships without recursing through its own RLS).
create or replace function public.is_member(target_org uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.memberships
    where user_id = auth.uid()
      and org_id  = target_org
  );
$$;

revoke execute on function public.is_member(uuid) from public;
grant  execute on function public.is_member(uuid) to authenticated;

alter table public.organizations enable row level security;
drop policy if exists org_select on public.organizations;
create policy org_select on public.organizations
  for select using (public.is_member(id));

alter table public.memberships enable row level security;
drop policy if exists membership_select on public.memberships;
create policy membership_select on public.memberships
  for select using (user_id = auth.uid());

comment on table public.organizations is
  'Multi-account model: one org per Founder account or Deal Company (type=spv). Step 1 foundation.';
