-- iCFO Credits: a closed-loop, no-cash-value loyalty ledger.
-- Credits are earned 1:1 from gamification points (per profile, carried across
-- events) and redeemed for a fixed catalog of iCFO services. NOT money, not a
-- security, no cash value. All writes happen server-side via the service role;
-- users may only read their own ledger + redemptions.

create extension if not exists pgcrypto;

-- ── ledger ────────────────────────────────────────────────────────────────────
create table if not exists public.credit_ledger (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid not null references public.profiles(id) on delete cascade,
  delta         integer not null,                 -- + earn, - redeem/expire/reversal
  reason        text not null,                     -- 'earn:<action>', 'redeem', 'expire', 'reversal', 'adjust'
  ref           text not null default '',          -- idempotency key
  event_id      uuid references public.events(id) on delete set null,
  redemption_id uuid,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz,
  unique (profile_id, reason, ref)
);
create index if not exists credit_ledger_profile_idx on public.credit_ledger (profile_id);
create index if not exists credit_ledger_profile_created_idx on public.credit_ledger (profile_id, created_at desc);

-- ── catalog ───────────────────────────────────────────────────────────────────
create table if not exists public.credit_catalog (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  cost        integer not null check (cost > 0),
  active      boolean not null default true,
  sort        integer not null default 0,
  created_at  timestamptz not null default now()
);

-- ── redemptions ───────────────────────────────────────────────────────────────
create table if not exists public.credit_redemptions (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  item_id     uuid not null references public.credit_catalog(id),
  title       text not null,     -- snapshot
  cost        integer not null,  -- snapshot
  status      text not null default 'pending',  -- 'pending' | 'fulfilled' | 'reversed'
  created_at  timestamptz not null default now()
);
create index if not exists credit_redemptions_profile_idx on public.credit_redemptions (profile_id, created_at desc);

-- ── RLS ───────────────────────────────────────────────────────────────────────
alter table public.credit_ledger enable row level security;
alter table public.credit_catalog enable row level security;
alter table public.credit_redemptions enable row level security;

-- Users read their own ledger + redemptions; no client writes (service role only).
drop policy if exists credit_ledger_select_own on public.credit_ledger;
create policy credit_ledger_select_own on public.credit_ledger
  for select using (auth.uid() = profile_id);

drop policy if exists credit_redemptions_select_own on public.credit_redemptions;
create policy credit_redemptions_select_own on public.credit_redemptions
  for select using (auth.uid() = profile_id);

-- Catalog: any authenticated user may read active items; writes via service role.
drop policy if exists credit_catalog_select_active on public.credit_catalog;
create policy credit_catalog_select_active on public.credit_catalog
  for select using (active = true or auth.role() = 'service_role');
