-- SPV document readiness checklist (operational tracking only).

create table if not exists public.spv_checklist_items (
  id uuid primary key default gen_random_uuid(),
  spv_opportunity_id uuid not null references public.spv_opportunities(id) on delete cascade,
  item_key text not null,
  title text not null,
  description text,
  category text not null check (
    category in (
      'legal',
      'investor_docs',
      'banking',
      'compliance',
      'tax',
      'reporting',
      'admin'
    )
  ),
  status text not null default 'pending' check (
    status in ('pending', 'in_progress', 'completed', 'waived')
  ),
  required boolean not null default true,
  completed_by uuid references public.profiles(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (spv_opportunity_id, item_key)
);

create index if not exists spv_checklist_items_spv_id_idx on public.spv_checklist_items (spv_opportunity_id);
create index if not exists spv_checklist_items_status_idx on public.spv_checklist_items (status);

alter table public.spv_opportunities
  add column if not exists checklist_readiness_pct integer not null default 0,
  add column if not exists document_ready_at timestamptz;

alter table public.spv_checklist_items enable row level security;

drop policy if exists "spv_checklist_items_select_staff" on public.spv_checklist_items;
create policy "spv_checklist_items_select_staff"
  on public.spv_checklist_items for select to authenticated
  using (public.is_staff());

drop policy if exists "spv_checklist_items_insert_staff" on public.spv_checklist_items;
create policy "spv_checklist_items_insert_staff"
  on public.spv_checklist_items for insert to authenticated
  with check (public.is_staff());

drop policy if exists "spv_checklist_items_update_staff" on public.spv_checklist_items;
create policy "spv_checklist_items_update_staff"
  on public.spv_checklist_items for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists "spv_checklist_items_delete_staff" on public.spv_checklist_items;
create policy "spv_checklist_items_delete_staff"
  on public.spv_checklist_items for delete to authenticated
  using (public.is_staff());

drop policy if exists "spv_checklist_items_select_founder" on public.spv_checklist_items;
create policy "spv_checklist_items_select_founder"
  on public.spv_checklist_items for select to authenticated
  using (
    exists (
      select 1
      from public.spv_opportunities o
      where o.id = spv_checklist_items.spv_opportunity_id
        and public.user_can_manage_company(o.company_id)
    )
  );
