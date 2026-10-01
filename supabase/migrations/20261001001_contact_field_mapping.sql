-- iCapOS: contact field mapping, Needs mapping queue, missing field fill
-- APPLIED to production on Oct 1, 2026 (main block, then the index on its own).
-- RLS is on with no policies on purpose: only the service role (admin API routes) reads or writes.
-- Additive only. No existing column is altered or dropped.
-- Run in the Supabase SQL editor (mvp-platform). Safe to re-run.

begin;

-- 1. Saved decision per source column ------------------------------------
create table if not exists public.contact_field_mappings (
  id            uuid primary key default gen_random_uuid(),
  source        text not null,                 -- 'odoo', 'odoo-ir', 'csv', 'xlsx', future keys
  source_column text not null,                 -- column name exactly as the source sends it
  action        text not null check (action in ('map','custom','ignore')),
  target_field  text,                          -- crm_contacts column when action = 'map'
  custom_key    text,                          -- contact_custom_fields.key when action = 'custom'
  updated_by    uuid,
  updated_at    timestamptz not null default now(),
  constraint contact_field_mappings_uniq unique (source, source_column),
  constraint contact_field_mappings_target_chk check (
    (action = 'map'    and target_field is not null and custom_key is null) or
    (action = 'custom' and custom_key   is not null and target_field is null) or
    (action = 'ignore' and target_field is null     and custom_key is null)
  )
);

-- 2. Custom text fields created from the mapping screen -------------------
create table if not exists public.contact_custom_fields (
  key        text primary key check (key ~ '^[a-z][a-z0-9_]{0,62}$'),
  label      text not null,
  created_by uuid,
  created_at timestamptz not null default now()
);

-- 3. Held values from unmapped columns during scheduled syncs -------------
create table if not exists public.contact_pending_values (
  id            uuid primary key default gen_random_uuid(),
  source        text not null,
  source_column text not null,
  contact_id    uuid not null references public.crm_contacts(id) on delete cascade,
  value         text not null,                 -- exactly as received, never reformatted
  first_seen_at timestamptz not null default now(),
  resolved_at   timestamptz,
  constraint contact_pending_values_uniq unique (source, source_column, contact_id)
);

-- Badge count and queue page read only unresolved rows through this index.
create index if not exists contact_pending_values_open_idx
  on public.contact_pending_values (source, source_column)
  where resolved_at is null;

-- 4. Proposed fills awaiting approval -------------------------------------
create table if not exists public.contact_fill_proposals (
  id          uuid primary key default gen_random_uuid(),
  run_id      uuid not null,
  contact_id  uuid not null references public.crm_contacts(id) on delete cascade,
  field       text not null,
  value       text not null,
  method      text not null check (method in ('website','domain','linkedin','company_record','rule')),
  basis       text not null,                   -- one line shown in the preview
  status      text not null default 'proposed' check (status in ('proposed','approved','rejected')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists contact_fill_proposals_run_idx
  on public.contact_fill_proposals (run_id, contact_id);

-- 30 day homepage cache so a shared domain is fetched once
create table if not exists public.contact_domain_cache (
  domain     text primary key,
  fetched_at timestamptz not null default now(),
  status     integer,                          -- HTTP status, null on timeout
  parsed     jsonb not null default '{}'::jsonb -- title, site_name, description, org json
);

-- 5. Where each filled value came from ------------------------------------
alter table public.crm_contacts
  add column if not exists field_sources jsonb not null default '{}'::jsonb;

-- 6. Access: admin API routes use the service role. Lock tables to it. -----
alter table public.contact_field_mappings  enable row level security;
alter table public.contact_custom_fields   enable row level security;
alter table public.contact_pending_values  enable row level security;
alter table public.contact_fill_proposals  enable row level security;
alter table public.contact_domain_cache    enable row level security;
-- No policies are created, so only the service role can read or write.

commit;

-- 7. Index for cascade step 3 (company record lookup) ---------------------
-- RUN THIS STATEMENT ALONE, after the block above. CONCURRENTLY cannot run
-- inside a transaction, and it keeps crm_contacts writable while it builds.
-- prospect_investors_domain_idx already exists (checked Oct 1, 2026).
create index concurrently if not exists crm_contacts_company_domain_idx
  on public.crm_contacts (company_domain)
  where company_domain is not null;
