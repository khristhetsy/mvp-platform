-- SPV operational closing review (not legal closing or securities execution).

create table if not exists public.spv_closing_reviews (
  id uuid primary key default gen_random_uuid(),
  spv_opportunity_id uuid not null unique references public.spv_opportunities(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  status text not null default 'not_started' check (
    status in (
      'not_started',
      'in_review',
      'approved_for_closing',
      'changes_required',
      'closed_operationally',
      'canceled'
    )
  ),
  readiness_snapshot jsonb not null default '{}'::jsonb,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists spv_closing_reviews_company_id_idx on public.spv_closing_reviews (company_id);

alter table public.spv_opportunities
  add column if not exists closing_readiness_pct integer not null default 0,
  add column if not exists investor_closing_status text,
  add column if not exists closing_final_review_notified boolean not null default false,
  add column if not exists closing_approved_notified boolean not null default false,
  add column if not exists closing_target_override boolean not null default false;

alter table public.spv_closing_reviews enable row level security;

drop policy if exists "spv_closing_reviews_select_staff" on public.spv_closing_reviews;
create policy "spv_closing_reviews_select_staff"
  on public.spv_closing_reviews for select to authenticated
  using (public.is_staff());

drop policy if exists "spv_closing_reviews_insert_staff" on public.spv_closing_reviews;
create policy "spv_closing_reviews_insert_staff"
  on public.spv_closing_reviews for insert to authenticated
  with check (public.is_staff());

drop policy if exists "spv_closing_reviews_update_staff" on public.spv_closing_reviews;
create policy "spv_closing_reviews_update_staff"
  on public.spv_closing_reviews for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists "spv_closing_reviews_delete_staff" on public.spv_closing_reviews;
create policy "spv_closing_reviews_delete_staff"
  on public.spv_closing_reviews for delete to authenticated
  using (public.is_staff());

drop policy if exists "spv_closing_reviews_select_founder" on public.spv_closing_reviews;
create policy "spv_closing_reviews_select_founder"
  on public.spv_closing_reviews for select to authenticated
  using (public.user_can_manage_company(company_id));
