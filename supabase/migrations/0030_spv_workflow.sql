-- SPV workflow foundation (non-binding indications only).

create table if not exists public.spv_opportunities (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete restrict,
  name text not null,
  target_amount numeric,
  minimum_commitment numeric,
  status text not null default 'draft' check (
    status in ('draft', 'under_review', 'open', 'closed', 'canceled')
  ),
  description text,
  terms_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.spv_participations (
  id uuid primary key default gen_random_uuid(),
  spv_opportunity_id uuid not null references public.spv_opportunities(id) on delete cascade,
  investor_id uuid not null references public.profiles(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  indicative_amount numeric,
  status text not null default 'invited' check (
    status in (
      'invited',
      'interested',
      'soft_committed',
      'documents_pending',
      'completed',
      'declined',
      'canceled'
    )
  ),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (spv_opportunity_id, investor_id)
);

create index if not exists spv_opportunities_company_id_idx on public.spv_opportunities (company_id);
create index if not exists spv_opportunities_status_idx on public.spv_opportunities (status);
create index if not exists spv_participations_spv_id_idx on public.spv_participations (spv_opportunity_id);
create index if not exists spv_participations_investor_id_idx on public.spv_participations (investor_id);
create index if not exists spv_participations_company_id_idx on public.spv_participations (company_id);

alter table public.spv_opportunities enable row level security;
alter table public.spv_participations enable row level security;

-- spv_opportunities
drop policy if exists "spv_opportunities_select_staff" on public.spv_opportunities;
create policy "spv_opportunities_select_staff"
  on public.spv_opportunities for select to authenticated
  using (public.is_staff());

drop policy if exists "spv_opportunities_insert_staff" on public.spv_opportunities;
create policy "spv_opportunities_insert_staff"
  on public.spv_opportunities for insert to authenticated
  with check (public.is_staff());

drop policy if exists "spv_opportunities_update_staff" on public.spv_opportunities;
create policy "spv_opportunities_update_staff"
  on public.spv_opportunities for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists "spv_opportunities_select_founder" on public.spv_opportunities;
create policy "spv_opportunities_select_founder"
  on public.spv_opportunities for select to authenticated
  using (public.user_can_manage_company(company_id));

drop policy if exists "spv_opportunities_select_investor" on public.spv_opportunities;
create policy "spv_opportunities_select_investor"
  on public.spv_opportunities for select to authenticated
  using (
    status = 'open'
    or exists (
      select 1
      from public.spv_participations p
      where p.spv_opportunity_id = spv_opportunities.id
        and p.investor_id = auth.uid()
    )
  );

-- spv_participations
drop policy if exists "spv_participations_select_staff" on public.spv_participations;
create policy "spv_participations_select_staff"
  on public.spv_participations for select to authenticated
  using (public.is_staff());

drop policy if exists "spv_participations_insert_staff" on public.spv_participations;
create policy "spv_participations_insert_staff"
  on public.spv_participations for insert to authenticated
  with check (public.is_staff());

drop policy if exists "spv_participations_update_staff" on public.spv_participations;
create policy "spv_participations_update_staff"
  on public.spv_participations for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists "spv_participations_select_founder" on public.spv_participations;
create policy "spv_participations_select_founder"
  on public.spv_participations for select to authenticated
  using (public.user_can_manage_company(company_id));

drop policy if exists "spv_participations_select_own" on public.spv_participations;
create policy "spv_participations_select_own"
  on public.spv_participations for select to authenticated
  using (investor_id = auth.uid());

drop policy if exists "spv_participations_insert_own" on public.spv_participations;
create policy "spv_participations_insert_own"
  on public.spv_participations for insert to authenticated
  with check (
    investor_id = auth.uid()
    and exists (
      select 1
      from public.spv_opportunities o
      where o.id = spv_opportunity_id
        and o.status = 'open'
    )
  );

drop policy if exists "spv_participations_update_own" on public.spv_participations;
create policy "spv_participations_update_own"
  on public.spv_participations for update to authenticated
  using (investor_id = auth.uid())
  with check (investor_id = auth.uid());

-- CRM activity for SPV interest
alter table public.investor_activity drop constraint if exists investor_activity_activity_type_check;

alter table public.investor_activity add constraint investor_activity_activity_type_check check (
  activity_type in (
    'saved_deal',
    'expressed_interest',
    'requested_intro',
    'follow_up_requested',
    'pledge_amount_submitted',
    'message_thread_created',
    'message_sent',
    'meeting_requested',
    'meeting_accepted',
    'meeting_declined',
    'report_viewed',
    'spv_interest_expressed'
  )
) NOT VALID;
