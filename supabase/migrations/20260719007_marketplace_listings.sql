-- Dual-lane model — Lane A (marketplace) schema.
--
-- Mapped onto `companies` (this repo has no founder_profiles). The spec's
-- founder_profile_id becomes company_id. Reg-CF eligibility is checked against
-- companies.offering_type (see 20260719006_offering_type.sql).
--
-- Tombstone-safe columns ONLY. No pitch/traction/financials columns — adding any
-- is a compliance decision, not a schema tweak.

do $$ begin
  create type listing_status as enum ('draft', 'pending_review', 'live', 'paused', 'closed', 'rejected');
exception when duplicate_object then null; end $$;

create extension if not exists btree_gist;

create table if not exists public.marketplace_listings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  status listing_status not null default 'draft',
  slug text unique,

  -- Tombstone-safe fields ONLY.
  company_name text not null,
  brief_description text not null check (char_length(brief_description) <= 280),
  industry text,
  location text,
  offering_amount_min numeric,
  offering_amount_max numeric,
  security_type text,
  portal_name text not null,
  portal_url text not null,
  logo_path text,
  readiness_band text,          -- display band derived from lead_prescore at publish; never the raw score

  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  published_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint one_live_listing_per_company
    exclude (company_id with =) where (status = 'live')
);

create index if not exists idx_listings_status on public.marketplace_listings(status);
create index if not exists idx_listings_company on public.marketplace_listings(company_id);

-- ── Reg-CF-only enforcement (structural, not just app logic) ──────────────────
create or replace function public.enforce_reg_cf_only()
returns trigger language plpgsql as $$
begin
  if not exists (
    select 1 from public.companies
    where id = new.company_id and offering_type = 'reg_cf'
  ) then
    raise exception 'Marketplace listings are restricted to Reg CF companies';
  end if;
  return new;
end $$;

drop trigger if exists trg_reg_cf_only on public.marketplace_listings;
create trigger trg_reg_cf_only
  before insert or update on public.marketplace_listings
  for each row execute function public.enforce_reg_cf_only();

-- If a company changes offering_type away from reg_cf, auto-pause any live listing.
create or replace function public.autopause_non_reg_cf_listings()
returns trigger language plpgsql as $$
begin
  if new.offering_type is distinct from 'reg_cf' and old.offering_type = 'reg_cf' then
    update public.marketplace_listings
      set status = 'paused', updated_at = now()
      where company_id = new.id and status = 'live';
  end if;
  return new;
end $$;

drop trigger if exists trg_autopause_listings on public.companies;
create trigger trg_autopause_listings
  after update of offering_type on public.companies
  for each row execute function public.autopause_non_reg_cf_listings();

-- ── RLS: public-read regime ───────────────────────────────────────────────────
alter table public.marketplace_listings enable row level security;

drop policy if exists "public_read_live_listings" on public.marketplace_listings;
create policy "public_read_live_listings"
  on public.marketplace_listings for select
  to anon, authenticated
  using (status = 'live');

drop policy if exists "founder_manage_own_listing" on public.marketplace_listings;
create policy "founder_manage_own_listing"
  on public.marketplace_listings for all
  to authenticated
  using (company_id in (select id from public.companies where founder_id = auth.uid()))
  with check (company_id in (select id from public.companies where founder_id = auth.uid()));

drop policy if exists "staff_manage_listings" on public.marketplace_listings;
create policy "staff_manage_listings"
  on public.marketplace_listings for all
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- ── Express-interest inbox (pledge-only, non-binding) ─────────────────────────
create table if not exists public.listing_interest (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.marketplace_listings(id) on delete cascade,
  full_name text not null check (char_length(full_name) <= 120),
  email text not null check (char_length(email) <= 254),
  intended_amount_text text check (char_length(intended_amount_text) <= 40),
  -- free-text on purpose: informational, non-binding; never parsed into money math
  source text not null default 'marketplace_card',
  ip_hash text,                 -- sha256(ip + daily salt), for rate limiting only
  created_at timestamptz not null default now()
);

create index if not exists idx_interest_listing on public.listing_interest(listing_id, created_at);
create index if not exists idx_interest_iphash on public.listing_interest(ip_hash, created_at);

-- No anon/authenticated select or insert policies: writes happen ONLY via the
-- server action using the service role (which bypasses RLS). Founders read their
-- own listing's interest via a dedicated dashboard query (separate ticket).
alter table public.listing_interest enable row level security;
