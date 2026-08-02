-- iCapOS public marketing site data model (site build spec §8).
-- demo_bookings + marketing_leads are written only through route handlers using
-- the service role after validation; anon can never select them. marketing_events
-- and client_logos are anon-readable (active rows only) for the public site.

create table if not exists public.demo_bookings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  role text not null check (role in ('founder','investor')),
  name text not null,
  email text not null,
  company text,
  topic text,
  requested_at timestamptz not null,
  duration_minutes int default 30,
  source_page text,
  ai_session_id uuid,
  status text default 'requested'
);

create table if not exists public.marketing_leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  name text,
  email text not null,
  company text,
  website text,
  stage text,
  raise_target text,
  -- Capital structure must offer Reg D, Reg CF, Reg A+, "not sure" (§8).
  capital_structure text check (capital_structure in ('reg_d','reg_cf','reg_a_plus','not_sure')),
  start_choice text,
  source_page text,
  utm jsonb
);

create table if not exists public.marketing_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  kind text check (kind in ('expo','conference')),
  city text,
  starts_at timestamptz,
  ends_at timestamptz,
  registration_open boolean default false,
  banner_url text,
  sort_order int
);

create table if not exists public.client_logos (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text not null,
  sort_order int,
  active boolean default true
);

alter table public.demo_bookings enable row level security;
alter table public.marketing_leads enable row level security;
alter table public.marketing_events enable row level security;
alter table public.client_logos enable row level security;

-- Anon may read active marketing_events + client_logos only. No anon read on the
-- lead/booking tables; inserts happen via service-role route handlers.
drop policy if exists "anon_read_marketing_events" on public.marketing_events;
create policy "anon_read_marketing_events" on public.marketing_events
  for select using (true);

drop policy if exists "anon_read_client_logos" on public.client_logos;
create policy "anon_read_client_logos" on public.client_logos
  for select using (active = true);

-- Staff (admin/analyst) may read the lead + booking tables to work them.
drop policy if exists "staff_read_demo_bookings" on public.demo_bookings;
create policy "staff_read_demo_bookings" on public.demo_bookings
  for select using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','analyst')));

drop policy if exists "staff_read_marketing_leads" on public.marketing_leads;
create policy "staff_read_marketing_leads" on public.marketing_leads
  for select using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','analyst')));

create index if not exists marketing_events_sort_idx on public.marketing_events (sort_order, starts_at);
create index if not exists client_logos_sort_idx on public.client_logos (sort_order) where active = true;
