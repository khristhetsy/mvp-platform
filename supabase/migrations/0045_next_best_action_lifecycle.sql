-- Next Best Action lifecycle (persisted operational workflow state).

create table if not exists public.next_best_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  role text not null check (role in ('founder', 'investor', 'admin', 'analyst')),
  entity_type text,
  entity_id uuid,
  company_id uuid references public.companies(id) on delete set null,
  investor_id uuid references public.profiles(id) on delete set null,
  spv_id uuid references public.spv_opportunities(id) on delete set null,
  action_type text not null,
  title text not null,
  description text not null default '',
  priority text not null check (priority in ('critical', 'high', 'medium', 'low')),
  category text not null check (
    category in (
      'onboarding',
      'readiness',
      'compliance',
      'investor_engagement',
      'spv',
      'documents',
      'reporting',
      'outreach',
      'admin_review',
      'system'
    )
  ),
  status text not null default 'open' check (
    status in ('open', 'snoozed', 'dismissed', 'completed', 'overdue', 'escalated', 'blocked')
  ),
  href text not null,
  source_module text not null,
  source_event_id uuid,
  reason text,
  blockers jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  dedupe_key text not null,
  source_signature text not null default '',
  due_at timestamptz,
  snoozed_until timestamptz,
  dismissed_at timestamptz,
  completed_at timestamptz,
  escalated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists next_best_actions_user_id_idx on public.next_best_actions (user_id);
create index if not exists next_best_actions_role_idx on public.next_best_actions (role);
create index if not exists next_best_actions_status_idx on public.next_best_actions (status);
create index if not exists next_best_actions_priority_idx on public.next_best_actions (priority);
create index if not exists next_best_actions_company_id_idx on public.next_best_actions (company_id);
create index if not exists next_best_actions_investor_id_idx on public.next_best_actions (investor_id);
create index if not exists next_best_actions_spv_id_idx on public.next_best_actions (spv_id);
create index if not exists next_best_actions_action_type_idx on public.next_best_actions (action_type);
create index if not exists next_best_actions_created_at_idx on public.next_best_actions (created_at desc);
create index if not exists next_best_actions_due_at_idx on public.next_best_actions (due_at);

create unique index if not exists next_best_actions_active_dedupe_idx
  on public.next_best_actions (user_id, role, dedupe_key)
  where status in ('open', 'snoozed', 'overdue', 'blocked', 'escalated');

alter table public.next_best_actions enable row level security;

drop policy if exists "next_best_actions_select_own" on public.next_best_actions;
create policy "next_best_actions_select_own"
  on public.next_best_actions for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "next_best_actions_select_staff" on public.next_best_actions;
create policy "next_best_actions_select_staff"
  on public.next_best_actions for select to authenticated
  using (public.is_staff());

drop policy if exists "next_best_actions_insert_own" on public.next_best_actions;
create policy "next_best_actions_insert_own"
  on public.next_best_actions for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "next_best_actions_insert_staff" on public.next_best_actions;
create policy "next_best_actions_insert_staff"
  on public.next_best_actions for insert to authenticated
  with check (public.is_staff());

drop policy if exists "next_best_actions_update_own" on public.next_best_actions;
create policy "next_best_actions_update_own"
  on public.next_best_actions for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "next_best_actions_update_staff" on public.next_best_actions;
create policy "next_best_actions_update_staff"
  on public.next_best_actions for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists "next_best_actions_delete_staff" on public.next_best_actions;
create policy "next_best_actions_delete_staff"
  on public.next_best_actions for delete to authenticated
  using (public.is_staff());
