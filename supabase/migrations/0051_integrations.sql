-- Enterprise external integrations (Phase 1).
-- Rollback: drop outbound_event_subscriptions, integration_delivery_logs, integration_connections.

create table if not exists public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (
    provider in (
      'slack',
      'gmail_foundation',
      'webhook',
      'hubspot_foundation',
      'docusign_foundation',
      'calendar_foundation'
    )
  ),
  display_name text not null default '',
  status text not null default 'disabled' check (status in ('active', 'disabled', 'error')),
  enabled boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  last_delivery_at timestamptz,
  last_failure_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists integration_connections_provider_idx
  on public.integration_connections (provider);

create table if not exists public.outbound_event_subscriptions (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.integration_connections(id) on delete cascade,
  event_type text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique (connection_id, event_type)
);

create index if not exists outbound_event_subscriptions_event_idx
  on public.outbound_event_subscriptions (event_type, enabled);

create table if not exists public.integration_delivery_logs (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.integration_connections(id) on delete cascade,
  event_type text not null,
  status text not null default 'pending' check (
    status in ('pending', 'success', 'failed', 'retrying', 'skipped')
  ),
  attempt_count int not null default 0,
  max_attempts int not null default 4,
  response_code int,
  error_message text,
  payload_metadata jsonb not null default '{}'::jsonb,
  next_retry_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists integration_delivery_logs_connection_idx
  on public.integration_delivery_logs (connection_id, created_at desc);

create index if not exists integration_delivery_logs_retry_idx
  on public.integration_delivery_logs (status, next_retry_at)
  where status in ('failed', 'retrying');

alter table public.integration_connections enable row level security;
alter table public.outbound_event_subscriptions enable row level security;
alter table public.integration_delivery_logs enable row level security;

drop policy if exists "integration_connections_staff" on public.integration_connections;
create policy "integration_connections_staff"
  on public.integration_connections for all to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'analyst'))
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'analyst'))
  );

drop policy if exists "integration_subscriptions_staff" on public.outbound_event_subscriptions;
create policy "integration_subscriptions_staff"
  on public.outbound_event_subscriptions for all to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'analyst'))
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'analyst'))
  );

drop policy if exists "integration_delivery_logs_staff" on public.integration_delivery_logs;
create policy "integration_delivery_logs_staff"
  on public.integration_delivery_logs for select to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'analyst'))
  );
