-- SPV investor document intake tracker (operational only).

create table if not exists public.spv_participation_requirements (
  id uuid primary key default gen_random_uuid(),
  spv_participation_id uuid not null references public.spv_participations(id) on delete cascade,
  spv_opportunity_id uuid not null references public.spv_opportunities(id) on delete cascade,
  investor_id uuid not null references public.profiles(id) on delete cascade,
  requirement_key text not null,
  title text not null,
  description text,
  category text not null check (
    category in (
      'subscription_docs',
      'accreditation',
      'kyc_aml',
      'tax',
      'banking',
      'admin_review'
    )
  ),
  status text not null default 'pending' check (
    status in ('pending', 'uploaded', 'under_review', 'approved', 'rejected', 'waived')
  ),
  required boolean not null default true,
  uploaded_document_id uuid references public.documents(id) on delete set null,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (spv_participation_id, requirement_key)
);

create index if not exists spv_participation_requirements_participation_idx
  on public.spv_participation_requirements (spv_participation_id);
create index if not exists spv_participation_requirements_spv_idx
  on public.spv_participation_requirements (spv_opportunity_id);
create index if not exists spv_participation_requirements_investor_idx
  on public.spv_participation_requirements (investor_id);

alter table public.spv_participations
  add column if not exists document_readiness_pct integer not null default 0,
  add column if not exists document_ready_at timestamptz;

alter table public.spv_opportunities
  add column if not exists investors_document_ready_count integer not null default 0,
  add column if not exists investor_pending_requirements_count integer not null default 0;

alter table public.spv_participation_requirements enable row level security;

drop policy if exists "spv_participation_requirements_select_staff" on public.spv_participation_requirements;
create policy "spv_participation_requirements_select_staff"
  on public.spv_participation_requirements for select to authenticated
  using (public.is_staff());

drop policy if exists "spv_participation_requirements_insert_staff" on public.spv_participation_requirements;
create policy "spv_participation_requirements_insert_staff"
  on public.spv_participation_requirements for insert to authenticated
  with check (public.is_staff());

drop policy if exists "spv_participation_requirements_update_staff" on public.spv_participation_requirements;
create policy "spv_participation_requirements_update_staff"
  on public.spv_participation_requirements for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists "spv_participation_requirements_delete_staff" on public.spv_participation_requirements;
create policy "spv_participation_requirements_delete_staff"
  on public.spv_participation_requirements for delete to authenticated
  using (public.is_staff());

drop policy if exists "spv_participation_requirements_select_own" on public.spv_participation_requirements;
create policy "spv_participation_requirements_select_own"
  on public.spv_participation_requirements for select to authenticated
  using (investor_id = auth.uid());

drop policy if exists "spv_participation_requirements_update_own" on public.spv_participation_requirements;
create policy "spv_participation_requirements_update_own"
  on public.spv_participation_requirements for update to authenticated
  using (investor_id = auth.uid())
  with check (investor_id = auth.uid());
