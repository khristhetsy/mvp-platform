-- Founder readiness remediation tasks (Phase 1 action plan).
-- Rollback: drop table public.founder_remediation_tasks (policies drop with table).

create table if not exists public.founder_remediation_tasks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  founder_id uuid not null references public.profiles(id) on delete cascade,
  source_type text not null,
  source_key text not null,
  category text not null check (
    category in (
      'company_profile',
      'documents',
      'financials',
      'governance',
      'market',
      'investor_materials',
      'readiness',
      'compliance'
    )
  ),
  title text not null,
  description text not null,
  priority text not null check (priority in ('high', 'medium', 'low')),
  status text not null default 'open' check (
    status in ('open', 'in_progress', 'completed', 'dismissed')
  ),
  recommended_action text not null,
  related_feature text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (company_id, source_key)
);

create index if not exists founder_remediation_tasks_company_id_idx on public.founder_remediation_tasks (company_id);
create index if not exists founder_remediation_tasks_founder_id_idx on public.founder_remediation_tasks (founder_id);
create index if not exists founder_remediation_tasks_status_idx on public.founder_remediation_tasks (status);

alter table public.founder_remediation_tasks enable row level security;

drop policy if exists "remediation_select_own" on public.founder_remediation_tasks;
create policy "remediation_select_own"
  on public.founder_remediation_tasks for select to authenticated
  using (founder_id = auth.uid());

drop policy if exists "remediation_insert_own" on public.founder_remediation_tasks;
create policy "remediation_insert_own"
  on public.founder_remediation_tasks for insert to authenticated
  with check (founder_id = auth.uid());

drop policy if exists "remediation_update_own" on public.founder_remediation_tasks;
create policy "remediation_update_own"
  on public.founder_remediation_tasks for update to authenticated
  using (founder_id = auth.uid())
  with check (founder_id = auth.uid());

drop policy if exists "remediation_select_staff" on public.founder_remediation_tasks;
create policy "remediation_select_staff"
  on public.founder_remediation_tasks for select to authenticated
  using (public.is_staff());
