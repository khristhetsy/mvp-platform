-- Phase 1 investor CRM: activity log + pipeline tracking.

create table if not exists public.investor_activity (
  id uuid primary key default gen_random_uuid(),
  investor_id uuid not null references public.profiles(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null,
  activity_type text not null check (
    activity_type in (
      'saved_deal',
      'expressed_interest',
      'requested_intro',
      'follow_up_requested'
    )
  ),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.investor_pipeline (
  id uuid primary key default gen_random_uuid(),
  investor_id uuid not null references public.profiles(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null,
  stage text not null default 'interested' check (
    stage in ('interested', 'meeting_requested', 'follow_up')
  ),
  probability integer not null default 25 check (probability >= 0 and probability <= 100),
  owner_admin_id uuid references public.profiles(id) on delete set null,
  last_activity_at timestamptz not null default now(),
  last_contacted_at timestamptz,
  next_follow_up_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (investor_id, company_id)
);

create index if not exists investor_activity_investor_id_idx on public.investor_activity (investor_id);
create index if not exists investor_activity_company_id_idx on public.investor_activity (company_id);
create index if not exists investor_activity_created_at_idx on public.investor_activity (created_at desc);
create index if not exists investor_activity_type_idx on public.investor_activity (activity_type);

create index if not exists investor_pipeline_investor_id_idx on public.investor_pipeline (investor_id);
create index if not exists investor_pipeline_company_id_idx on public.investor_pipeline (company_id);
create index if not exists investor_pipeline_stage_idx on public.investor_pipeline (stage);
create index if not exists investor_pipeline_last_activity_at_idx on public.investor_pipeline (last_activity_at desc);

alter table public.investor_activity enable row level security;
alter table public.investor_pipeline enable row level security;

-- investor_activity
drop policy if exists "investor_activity_select_staff" on public.investor_activity;
create policy "investor_activity_select_staff"
  on public.investor_activity for select to authenticated
  using (public.is_staff());

drop policy if exists "investor_activity_select_own" on public.investor_activity;
create policy "investor_activity_select_own"
  on public.investor_activity for select to authenticated
  using (investor_id = auth.uid() and public.is_investor());

drop policy if exists "investor_activity_insert_own" on public.investor_activity;
create policy "investor_activity_insert_own"
  on public.investor_activity for insert to authenticated
  with check (
    investor_id = auth.uid()
    and public.is_investor()
    and not public.investor_owns_company(company_id)
  );

-- investor_pipeline
drop policy if exists "investor_pipeline_select_staff" on public.investor_pipeline;
create policy "investor_pipeline_select_staff"
  on public.investor_pipeline for select to authenticated
  using (public.is_staff());

drop policy if exists "investor_pipeline_update_staff" on public.investor_pipeline;
create policy "investor_pipeline_update_staff"
  on public.investor_pipeline for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists "investor_pipeline_select_own" on public.investor_pipeline;
create policy "investor_pipeline_select_own"
  on public.investor_pipeline for select to authenticated
  using (investor_id = auth.uid() and public.is_investor());

drop policy if exists "investor_pipeline_insert_own" on public.investor_pipeline;
create policy "investor_pipeline_insert_own"
  on public.investor_pipeline for insert to authenticated
  with check (
    investor_id = auth.uid()
    and public.is_investor()
    and not public.investor_owns_company(company_id)
  );

drop policy if exists "investor_pipeline_update_own" on public.investor_pipeline;
create policy "investor_pipeline_update_own"
  on public.investor_pipeline for update to authenticated
  using (investor_id = auth.uid() and public.is_investor())
  with check (
    investor_id = auth.uid()
    and public.is_investor()
    and not public.investor_owns_company(company_id)
  );
