-- Admin compliance events (internal risk review queue).

create table if not exists public.compliance_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete set null,
  founder_id uuid references public.profiles(id) on delete set null,
  investor_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high', 'critical')),
  source text not null default 'system',
  title text not null,
  description text not null,
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open', 'under_review', 'resolved', 'dismissed')),
  internal_notes text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists compliance_events_status_idx on public.compliance_events (status);
create index if not exists compliance_events_severity_idx on public.compliance_events (severity);
create index if not exists compliance_events_company_id_idx on public.compliance_events (company_id);
create index if not exists compliance_events_created_at_idx on public.compliance_events (created_at desc);
create index if not exists compliance_events_event_type_idx on public.compliance_events (event_type);

alter table public.compliance_events enable row level security;

drop policy if exists "compliance_events_select_staff" on public.compliance_events;
create policy "compliance_events_select_staff"
  on public.compliance_events for select to authenticated
  using (public.is_staff());

drop policy if exists "compliance_events_update_staff" on public.compliance_events;
create policy "compliance_events_update_staff"
  on public.compliance_events for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists "compliance_events_insert_staff" on public.compliance_events;
create policy "compliance_events_insert_staff"
  on public.compliance_events for insert to authenticated
  with check (public.is_staff());
