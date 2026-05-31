-- SPV document package tracker (operational only, no legal generation).

create table if not exists public.spv_document_packages (
  id uuid primary key default gen_random_uuid(),
  spv_opportunity_id uuid not null references public.spv_opportunities(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  package_type text not null check (
    package_type in (
      'formation_package',
      'subscription_package',
      'investor_intake_package',
      'banking_package',
      'tax_package',
      'reporting_package',
      'final_closing_package'
    )
  ),
  status text not null default 'not_started' check (
    status in ('not_started', 'preparing', 'under_review', 'approved', 'issued', 'archived')
  ),
  prepared_by uuid references public.profiles(id) on delete set null,
  reviewed_by uuid references public.profiles(id) on delete set null,
  approved_by uuid references public.profiles(id) on delete set null,
  prepared_at timestamptz,
  reviewed_at timestamptz,
  approved_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (spv_opportunity_id, package_type)
);

create index if not exists spv_document_packages_spv_id_idx on public.spv_document_packages (spv_opportunity_id);
create index if not exists spv_document_packages_company_id_idx on public.spv_document_packages (company_id);

alter table public.spv_opportunities
  add column if not exists package_readiness_pct integer not null default 0,
  add column if not exists investor_package_status text,
  add column if not exists packages_fully_approved_notified boolean not null default false;

alter table public.spv_document_packages enable row level security;

drop policy if exists "spv_document_packages_select_staff" on public.spv_document_packages;
create policy "spv_document_packages_select_staff"
  on public.spv_document_packages for select to authenticated
  using (public.is_staff());

drop policy if exists "spv_document_packages_insert_staff" on public.spv_document_packages;
create policy "spv_document_packages_insert_staff"
  on public.spv_document_packages for insert to authenticated
  with check (public.is_staff());

drop policy if exists "spv_document_packages_update_staff" on public.spv_document_packages;
create policy "spv_document_packages_update_staff"
  on public.spv_document_packages for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists "spv_document_packages_delete_staff" on public.spv_document_packages;
create policy "spv_document_packages_delete_staff"
  on public.spv_document_packages for delete to authenticated
  using (public.is_staff());

drop policy if exists "spv_document_packages_select_founder" on public.spv_document_packages;
create policy "spv_document_packages_select_founder"
  on public.spv_document_packages for select to authenticated
  using (public.user_can_manage_company(company_id));
