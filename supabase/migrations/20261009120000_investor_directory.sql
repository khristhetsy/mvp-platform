-- Investor directory: public investor data compiled by iCFO, OUTSIDE the iCFO
-- investor network. Founders search it, accept the terms of use, and import
-- rows into their own address book (founder_investor_contacts, source
-- 'directory') for Manual outreach. Kept in its own table on purpose: network
-- investors (crm_contacts) never appear here, and directory rows never enter
-- network matching or gated intros. Service role only (RLS on, no policies);
-- every read and write goes through role-checked API routes.
-- Applied to production on 2026-10-09 through the Supabase connector.

create table if not exists public.investor_directory_imports (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  source text not null,
  source_url text,
  file_name text,
  row_count int not null default 0,
  created_count int not null default 0,
  merged_count int not null default 0,
  invalid_email_count int not null default 0,
  status text not null default 'verifying' check (status in ('cleaned','verifying','published')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  published_at timestamptz
);

create table if not exists public.investor_directory (
  id uuid primary key default gen_random_uuid(),
  firm text not null,
  contact_name text,
  title text,
  email text,
  phone text,
  website text,
  city text,
  state text,
  country text not null default 'US',
  -- Same option lists as the Sales contact profile (vocabulary_options slugs).
  investor_types text[] not null default '{}',
  funding_stages text[] not null default '{}',
  capital_types text[] not null default '{}',
  industries text[] not null default '{}',
  fund_name text,
  fund_size numeric,
  avg_investment numeric,
  strategy text,
  investing_now boolean,
  source text not null,
  source_url text,
  import_id uuid references public.investor_directory_imports(id) on delete set null,
  status text not null default 'draft' check (status in ('draft','published','suppressed')),
  verification text not null default 'unverified'
    check (verification in ('unverified','needs_input','verified','bounced','opt_out')),
  verified_at timestamptz,
  verified_by uuid references public.profiles(id) on delete set null,
  opted_out_at timestamptz,
  -- True when the same email is already an iCFO network investor. The network
  -- record wins: these rows never show to founders.
  in_network boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists investor_directory_email_uq
  on public.investor_directory (lower(email)) where email is not null;
create index if not exists investor_directory_listing_idx
  on public.investor_directory (status, in_network, firm);
create index if not exists investor_directory_import_idx on public.investor_directory (import_id);

create table if not exists public.investor_directory_tiers (
  key text primary key,
  label text not null,
  hold_limit int not null,
  show_email boolean not null default true,
  can_export boolean not null default false,
  -- Set by an admin on the Access page. Null = not priced yet (founders request access).
  price_cents int,
  sort int not null default 0
);

insert into public.investor_directory_tiers (key, label, hold_limit, show_email, can_export, sort) values
  ('free',          'Free',          0,     false, false, 0),
  ('directory_1k',  'Directory 1k',  1000,  true,  false, 1),
  ('directory_5k',  'Directory 5k',  5000,  true,  true,  2),
  ('directory_10k', 'Directory 10k', 10000, true,  true,  3),
  ('directory_15k', 'Directory 15k', 15000, true,  true,  4),
  ('directory_20k', 'Directory 20k', 20000, true,  true,  5)
on conflict (key) do nothing;

create table if not exists public.investor_directory_access (
  founder_id uuid primary key references public.profiles(id) on delete cascade,
  tier text not null default 'free' references public.investor_directory_tiers(key),
  status text not null default 'active' check (status in ('active','paused','suspended')),
  status_reason text,
  terms_version int,
  terms_accepted_at timestamptz,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.investor_directory_settings (
  id int primary key default 1 check (id = 1),
  block_over_limit boolean not null default true,
  daily_cap int not null default 500,
  spike_imports int not null default 1000,
  spike_hours int not null default 48,
  auto_pause_on_bounce boolean not null default true,
  bounce_pause_pct int not null default 10,
  bounce_min_sends int not null default 50,
  require_terms boolean not null default true,
  honor_opt_outs boolean not null default true,
  allow_export boolean not null default false,
  stale_days int not null default 180,
  terms_version int not null default 1,
  updated_at timestamptz not null default now()
);
insert into public.investor_directory_settings (id) values (1) on conflict (id) do nothing;

create table if not exists public.investor_directory_events (
  id uuid primary key default gen_random_uuid(),
  founder_id uuid not null references public.profiles(id) on delete cascade,
  company_id uuid references public.companies(id) on delete set null,
  kind text not null check (kind in ('import','export','terms','paused','suspended','reactivated','tier_changed','upgrade_requested')),
  count int not null default 0,
  detail text,
  created_at timestamptz not null default now()
);
create index if not exists investor_directory_events_founder_idx
  on public.investor_directory_events (founder_id, created_at desc);

alter table public.founder_investor_contacts
  add column if not exists directory_id uuid references public.investor_directory(id) on delete set null;
create index if not exists founder_investor_contacts_directory_idx
  on public.founder_investor_contacts (company_id, directory_id) where directory_id is not null;

alter table public.investor_directory enable row level security;
alter table public.investor_directory_imports enable row level security;
alter table public.investor_directory_tiers enable row level security;
alter table public.investor_directory_access enable row level security;
alter table public.investor_directory_settings enable row level security;
alter table public.investor_directory_events enable row level security;

-- Recompute in_network for every directory row (run after each import).
create or replace function public.investor_directory_refresh_network()
returns int language sql security definer set search_path = public as $$
  with upd as (
    update public.investor_directory d
       set in_network = exists (
             select 1 from public.crm_contacts c
              where c.side = 'investor' and c.email is not null and lower(c.email) = lower(d.email)),
           updated_at = now()
     where d.email is not null
    returning 1)
  select count(*)::int from upd;
$$;
revoke all on function public.investor_directory_refresh_network() from public, anon, authenticated;
