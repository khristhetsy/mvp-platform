-- CRM connector mirror: a source-agnostic local copy of external contacts
-- (Odoo first, then HubSpot / Salesforce / CSV via the same tables). The CRM
-- console reads this mirror; external systems remain the system of record.
--
-- PII posture: RLS is enabled with NO policies, so only the service-role
-- (server-side admin surfaces) can read/write. End-user roles get nothing.
-- Re-runnable.

create table if not exists public.crm_contacts (
  id uuid primary key default gen_random_uuid(),
  source text not null,               -- 'odoo' | 'hubspot' | 'csv' | ...
  external_id text not null,          -- the record id in the source system
  module text not null default 'unknown',  -- 'founder' | 'investor' | 'unknown'
  name text,
  email text,
  company text,
  stage text,
  owner text,
  plan text,
  tags text[] not null default '{}',
  raw jsonb,
  supabase_profile_id uuid references public.profiles(id),  -- linked by email, nullable
  synced_at timestamptz not null default now(),
  unique (source, external_id)
);

create index if not exists crm_contacts_module_idx on public.crm_contacts (module);
create index if not exists crm_contacts_email_idx on public.crm_contacts (lower(email));
create index if not exists crm_contacts_source_idx on public.crm_contacts (source);

create table if not exists public.crm_sync_state (
  source text primary key,
  last_full_import_at timestamptz,
  last_delta_at timestamptz,
  last_cursor text,
  total_imported integer not null default 0,
  last_error text,
  updated_at timestamptz not null default now()
);

alter table public.crm_contacts enable row level security;
alter table public.crm_sync_state enable row level security;
-- No policies added on purpose: service-role only (PII stays server-side).
