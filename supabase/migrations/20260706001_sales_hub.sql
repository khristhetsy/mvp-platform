-- Sales Hub — standalone founder product-sales (no Odoo dependency).
-- Pipelines, stages, and opportunities keyed to platform founders.
-- Service-role only (RLS on, no policy); access via admin API routes.

create table if not exists public.sales_pipelines (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_default boolean not null default false,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.sales_stages (
  id uuid primary key default gen_random_uuid(),
  pipeline_id uuid not null references public.sales_pipelines(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  is_won boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_sales_stages_pipeline on public.sales_stages (pipeline_id, sort_order);

create table if not exists public.sales_opportunities (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  contact_profile_id uuid references public.profiles(id) on delete set null,
  company_id uuid references public.companies(id) on delete set null,
  contact_name text,
  contact_email text,
  pipeline_id uuid references public.sales_pipelines(id) on delete set null,
  stage_id uuid references public.sales_stages(id) on delete set null,
  value_cents bigint,
  status text not null default 'open' check (status in ('open','won','lost','archived')),
  odoo_lead_id text,               -- reserved for optional future sync; unused today
  owner_id uuid references public.profiles(id) on delete set null,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_sales_opps_stage on public.sales_opportunities (stage_id) where status = 'open';
create index if not exists idx_sales_opps_status on public.sales_opportunities (status);

alter table public.sales_pipelines enable row level security;
alter table public.sales_stages enable row level security;
alter table public.sales_opportunities enable row level security;

-- Seed a default pipeline + stages (once).
do $$
declare pid uuid;
begin
  if not exists (select 1 from public.sales_pipelines where is_default) then
    insert into public.sales_pipelines (name, is_default) values ('Founder sales', true) returning id into pid;
    insert into public.sales_stages (pipeline_id, name, sort_order, is_won) values
      (pid, 'New lead', 0, false),
      (pid, 'Qualified', 1, false),
      (pid, 'Demo', 2, false),
      (pid, 'Proposal', 3, false),
      (pid, 'Won', 4, true);
  end if;
end $$;
