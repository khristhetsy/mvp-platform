-- Valuation Studio — schema + RLS (build spec §2, §2.5).
-- Founder-side only. No investor-facing surface reads these tables (enforced in
-- app + the valuation_investor_visible flag, default false). RLS scopes every
-- row to organization membership; staff (admin/analyst) read across orgs.

-- ── enums ─────────────────────────────────────────────────────────────
do $$ begin
  create type public.valuation_stage_profile as enum ('preseed', 'seed', 'revenue');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.valuation_source as enum ('profile', 'manual');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.valuation_arr_band as enum ('<1M', '1-5M', '5-20M', '20M+');
exception when duplicate_object then null; end $$;

-- ── valuations ────────────────────────────────────────────────────────
create table if not exists public.valuations (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  created_by       uuid not null references auth.users(id),
  company_name     text not null,
  sector           text,
  stage_profile    public.valuation_stage_profile not null,
  source           public.valuation_source not null,
  is_scenario      boolean not null default true,
  converged_low    numeric,
  converged_high   numeric,
  inputs           jsonb not null default '{}'::jsonb,
  input_provenance jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists valuations_org_idx     on public.valuations(organization_id);
create index if not exists valuations_created_idx  on public.valuations(created_at desc);

-- ── valuation_methods (stored, not recomputed on read) ─────────────────
create table if not exists public.valuation_methods (
  id            uuid primary key default gen_random_uuid(),
  valuation_id  uuid not null references public.valuations(id) on delete cascade,
  method_code   text not null,       -- BRK/SCR/RFS/VCM/OWN/TCM/PRC/DCF/AST
  low           numeric not null,
  high          numeric not null,
  basis_text    text,
  sort_order    int not null default 0
);
create index if not exists valuation_methods_val_idx on public.valuation_methods(valuation_id);

-- ── valuation_advice (audit of every generated plan) ───────────────────
create table if not exists public.valuation_advice (
  id            uuid primary key default gen_random_uuid(),
  valuation_id  uuid not null references public.valuations(id) on delete cascade,
  read          text,
  spread        text,
  caution       text,
  levers        jsonb not null default '[]'::jsonb,
  model         text,
  is_sample     boolean not null default false,
  generated_at  timestamptz not null default now()
);
create index if not exists valuation_advice_val_idx on public.valuation_advice(valuation_id);

-- ── sector_multiples (seeded quarterly by iCFO, never by founders) ─────
create table if not exists public.sector_multiples (
  id            uuid primary key default gen_random_uuid(),
  sector        text not null,
  arr_band      public.valuation_arr_band not null,
  growth_band   text not null,       -- e.g. 'low' | 'mid' | 'high'
  multiple_low  numeric not null,
  multiple_high numeric not null,
  source_name   text,
  source_url    text,
  as_of         date not null,
  unique (sector, arr_band, growth_band)
);

-- ── RLS ───────────────────────────────────────────────────────────────
alter table public.valuations        enable row level security;
alter table public.valuation_methods enable row level security;
alter table public.valuation_advice  enable row level security;
alter table public.sector_multiples  enable row level security;

-- helper: is the current user staff (admin/analyst)?
-- (inline exists() to avoid a new function dependency)

-- valuations: founders manage their org's rows; staff read all.
drop policy if exists valuations_member on public.valuations;
create policy valuations_member on public.valuations
  for all to authenticated
  using      (public.is_member(organization_id))
  with check (public.is_member(organization_id));

drop policy if exists valuations_staff_read on public.valuations;
create policy valuations_staff_read on public.valuations
  for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'analyst')));

-- child tables inherit access via their parent valuation.
drop policy if exists valuation_methods_member on public.valuation_methods;
create policy valuation_methods_member on public.valuation_methods
  for all to authenticated
  using      (exists (select 1 from public.valuations v where v.id = valuation_id and public.is_member(v.organization_id)))
  with check (exists (select 1 from public.valuations v where v.id = valuation_id and public.is_member(v.organization_id)));

drop policy if exists valuation_methods_staff_read on public.valuation_methods;
create policy valuation_methods_staff_read on public.valuation_methods
  for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'analyst')));

drop policy if exists valuation_advice_member on public.valuation_advice;
create policy valuation_advice_member on public.valuation_advice
  for all to authenticated
  using      (exists (select 1 from public.valuations v where v.id = valuation_id and public.is_member(v.organization_id)))
  with check (exists (select 1 from public.valuations v where v.id = valuation_id and public.is_member(v.organization_id)));

drop policy if exists valuation_advice_staff_read on public.valuation_advice;
create policy valuation_advice_staff_read on public.valuation_advice
  for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'analyst')));

-- sector_multiples: reference data readable by any authenticated user; only
-- staff (or the service role) may write. Founders never edit the reference band.
drop policy if exists sector_multiples_read on public.sector_multiples;
create policy sector_multiples_read on public.sector_multiples
  for select to authenticated using (true);

drop policy if exists sector_multiples_staff_write on public.sector_multiples;
create policy sector_multiples_staff_write on public.sector_multiples
  for all to authenticated
  using      (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'analyst')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'analyst')));

-- ── seed: reference multiples iCFO actually sees (placeholder bands, dated) ──
insert into public.sector_multiples (sector, arr_band, growth_band, multiple_low, multiple_high, source_name, as_of) values
  ('B2B SaaS', '<1M',   'high', 6,  12, 'iCFO reference Q3-2026', '2026-07-01'),
  ('B2B SaaS', '1-5M',  'high', 5,  9,  'iCFO reference Q3-2026', '2026-07-01'),
  ('B2B SaaS', '1-5M',  'mid',  4,  7,  'iCFO reference Q3-2026', '2026-07-01'),
  ('B2B SaaS', '5-20M', 'mid',  4,  6,  'iCFO reference Q3-2026', '2026-07-01'),
  ('Fintech',  '1-5M',  'high', 5,  10, 'iCFO reference Q3-2026', '2026-07-01'),
  ('Fintech',  '5-20M', 'mid',  4,  7,  'iCFO reference Q3-2026', '2026-07-01'),
  ('Healthtech','1-5M', 'high', 5,  9,  'iCFO reference Q3-2026', '2026-07-01'),
  ('Marketplace','1-5M','high', 3,  6,  'iCFO reference Q3-2026', '2026-07-01'),
  ('Consumer', '1-5M',  'mid',  2,  5,  'iCFO reference Q3-2026', '2026-07-01')
on conflict (sector, arr_band, growth_band) do nothing;

-- VERIFY:
--   select count(*) from public.sector_multiples;   -- expect 9
--   select tablename from pg_policies where tablename like 'valuation%';
