-- FIX: migration 20260730004 used table names (marketing_events, marketing_leads,
-- client_logos, demo_bookings) that collided with pre-existing tables, and it
-- attached RLS policies to them. Undo those policies so nothing pre-existing is
-- exposed, and give the marketing SITE its own namespaced tables.

drop policy if exists "anon_read_marketing_events" on public.marketing_events;
drop policy if exists "anon_read_client_logos" on public.client_logos;
drop policy if exists "staff_read_demo_bookings" on public.demo_bookings;
drop policy if exists "staff_read_marketing_leads" on public.marketing_leads;

create table if not exists public.marketing_site_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  kind text check (kind in ('expo','conference')),
  city text, starts_at timestamptz, ends_at timestamptz,
  registration_open boolean default false, banner_url text, sort_order int
);

create table if not exists public.marketing_site_logos (
  id uuid primary key default gen_random_uuid(),
  name text not null, logo_url text not null, sort_order int, active boolean default true
);

create table if not exists public.marketing_site_leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  name text, email text not null, company text, website text,
  stage text, raise_target text,
  capital_structure text check (capital_structure in ('reg_d','reg_cf','reg_a_plus','not_sure')),
  start_choice text, source_page text, utm jsonb
);

create table if not exists public.marketing_site_demo_bookings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  role text not null check (role in ('founder','investor')),
  name text not null, email text not null, company text, topic text,
  requested_at timestamptz not null, duration_minutes int default 30,
  source_page text, ai_session_id uuid, status text default 'requested'
);

alter table public.marketing_site_events enable row level security;
alter table public.marketing_site_logos enable row level security;
alter table public.marketing_site_leads enable row level security;
alter table public.marketing_site_demo_bookings enable row level security;

drop policy if exists "anon_read_site_events" on public.marketing_site_events;
create policy "anon_read_site_events" on public.marketing_site_events for select using (true);

drop policy if exists "anon_read_site_logos" on public.marketing_site_logos;
create policy "anon_read_site_logos" on public.marketing_site_logos for select using (active = true);

drop policy if exists "staff_read_site_leads" on public.marketing_site_leads;
create policy "staff_read_site_leads" on public.marketing_site_leads
  for select using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','analyst')));

drop policy if exists "staff_read_site_bookings" on public.marketing_site_demo_bookings;
create policy "staff_read_site_bookings" on public.marketing_site_demo_bookings
  for select using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','analyst')));

insert into public.marketing_site_events (title, kind, city, starts_at, ends_at, registration_open, sort_order)
values
  ('iCFO PE Expo — Newport Beach', 'expo', 'Newport Beach, California', '2026-08-25 19:00:00+00', '2026-08-25 23:00:00+00', true, 1),
  ('iCFO Investment Conference — September', 'conference', null, null, null, false, 2),
  ('iCFO PE Expo — city to be announced', 'expo', null, null, null, false, 3)
on conflict do nothing;

create index if not exists marketing_site_events_sort_idx on public.marketing_site_events (sort_order, starts_at);
create index if not exists marketing_site_logos_sort_idx on public.marketing_site_logos (sort_order) where active = true;
