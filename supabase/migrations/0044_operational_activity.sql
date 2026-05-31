-- Universal operational activity event layer (append-only, staff-readable in Phase 1).

create table if not exists public.operational_activity_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  event_category text not null check (
    event_category in (
      'crm',
      'onboarding',
      'diligence',
      'compliance',
      'spv',
      'investor',
      'founder',
      'reporting',
      'messaging',
      'outreach',
      'system',
      'imports',
      'analytics'
    )
  ),
  entity_type text not null,
  entity_id uuid,
  actor_user_id uuid references public.profiles(id) on delete set null,
  actor_role text,
  company_id uuid references public.companies(id) on delete set null,
  investor_id uuid references public.profiles(id) on delete set null,
  spv_id uuid references public.spv_opportunities(id) on delete set null,
  related_user_id uuid references public.profiles(id) on delete set null,
  severity text not null default 'info' check (
    severity in ('info', 'low', 'medium', 'high', 'critical')
  ),
  title text not null,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  source_module text not null,
  visibility text not null default 'admin_only' check (
    visibility in (
      'admin_only',
      'internal',
      'founder',
      'investor',
      'company_related',
      'public_summary'
    )
  ),
  created_at timestamptz not null default now()
);

create index if not exists operational_activity_events_created_at_idx
  on public.operational_activity_events (created_at desc);

create index if not exists operational_activity_events_company_id_idx
  on public.operational_activity_events (company_id, created_at desc);

create index if not exists operational_activity_events_investor_id_idx
  on public.operational_activity_events (investor_id, created_at desc);

create index if not exists operational_activity_events_spv_id_idx
  on public.operational_activity_events (spv_id, created_at desc);

create index if not exists operational_activity_events_entity_idx
  on public.operational_activity_events (entity_type, entity_id, created_at desc);

create index if not exists operational_activity_events_category_idx
  on public.operational_activity_events (event_category, created_at desc);

create index if not exists operational_activity_events_type_idx
  on public.operational_activity_events (event_type, created_at desc);

create index if not exists operational_activity_events_dedupe_idx
  on public.operational_activity_events ((metadata->>'dedupe_key'), created_at desc)
  where metadata ? 'dedupe_key';

alter table public.operational_activity_events enable row level security;

drop policy if exists "operational_activity_events_select_staff" on public.operational_activity_events;
create policy "operational_activity_events_select_staff"
  on public.operational_activity_events for select to authenticated
  using (public.is_staff());
