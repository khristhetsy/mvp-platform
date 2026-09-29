-- Subscription pricing becomes data instead of five hand-typed copies.
--
-- Today a price is written in PLAN_PRICES (cents), in priceLabel strings inside
-- plans.ts AND billing/pricing.ts, again in content/pricing.ts for the public page,
-- again in two AI prompts, and again in i18n keys literally named
-- founder_basic_499_mo — which is why /upgrade still quotes the old model.
--
-- One active set; saving appends a version. What LemonSqueezy actually charges is
-- NOT stored here (their prices are immutable and set in their dashboard) — the
-- admin screen reads the variant price live and warns when the two disagree.

create table if not exists public.pricing_sets (
  id                 uuid primary key default gen_random_uuid(),
  version            text not null unique,        -- 'pricing-v2'
  plans              jsonb not null,              -- { founder_basic: { cents, label, sublabel }, ... }
  add_company_cents  integer not null default 80000,
  reason             text,
  -- How existing subscribers are treated. 'grandfather' leaves their billed price
  -- alone; 'migrate' records that they were moved at the provider.
  existing_policy    text not null default 'grandfather' check (existing_policy in ('grandfather', 'migrate')),
  effective_at       timestamptz not null default now(),
  is_active          boolean not null default false,
  created_by         uuid references public.profiles(id),
  created_at         timestamptz not null default now()
);

create unique index if not exists pricing_sets_one_active on public.pricing_sets ((is_active)) where is_active;
create index if not exists pricing_sets_created_idx on public.pricing_sets (created_at desc);

alter table public.pricing_sets enable row level security;
drop policy if exists "staff_read" on public.pricing_sets;
create policy "staff_read" on public.pricing_sets
  for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'analyst')));

-- Seed: exactly today's numbers, so nothing moves until someone saves.
insert into public.pricing_sets (version, plans, add_company_cents, reason, is_active, created_by)
select
  'pricing-v1',
  '{
     "founder_free":         { "cents": 0,      "label": "$0",                  "sublabel": "Readiness" },
     "founder_basic":        { "cents": 4900,   "label": "$49",                 "sublabel": "/month" },
     "founder_professional": { "cents": 19900,  "label": "$199",                "sublabel": "/month" },
     "founder_managed_ir":   { "cents": 350000, "label": "Pricing on request",  "sublabel": "3-month minimum", "contactSales": true }
   }'::jsonb,
  80000,
  'Seeded from the code constants.',
  true,
  null
where not exists (select 1 from public.pricing_sets);

comment on table public.pricing_sets is
  'Versioned subscription pricing. One active row; every save appends. The amount actually charged lives at LemonSqueezy — this is what the app stores, computes MRR from, and shows.';
