-- Contact finder v2 (docs/contact-finder-spec.md, Step 2).
-- Learned email formats per domain, a log of every lookup (powers find rate by
-- source), suggestions persisted for review, and provenance + retention on the
-- contact. All idempotent. Writes go through the service role (API routes call
-- requireRole(["admin","analyst"])); staff get read access through RLS.

-- 1) Learned email format per company domain ---------------------------------
create table if not exists public.email_domain_patterns (
  domain text primary key,
  pattern text not null,                                   -- e.g. 'first.last' (the most common format)
  format_counts jsonb not null default '{}'::jsonb,         -- known emails per format, e.g. {"first.last": 3, "flast": 1}
  verified_samples int not null default 0,                  -- known emails that fit the pattern
  conflicting_samples int not null default 0,               -- known emails at the domain in another format
  catch_all boolean,                                        -- null = unknown (needs the Step 3 mailbox worker)
  role_inbox text,                                          -- e.g. info@acme.com; never assigned to a person
  last_checked_at timestamptz not null default now()
);

-- 2) One row per lookup attempt, per source ----------------------------------
create table if not exists public.contact_lookups (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.crm_contacts(id) on delete cascade,
  source text not null check (source in ('domain_pattern','site','web','pattern','manual_kaspr','manual_apollo','manual_other')),
  field text not null check (field in ('email','phone')),
  outcome text not null check (outcome in ('found','not_found','error','skipped_suppressed','skipped_budget')),
  value text,
  run_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists contact_lookups_source_idx on public.contact_lookups (source, created_at desc);
create index if not exists contact_lookups_contact_idx on public.contact_lookups (contact_id, created_at desc);

-- 3) Suggestions awaiting review ---------------------------------------------
create table if not exists public.contact_finder_suggestions (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.crm_contacts(id) on delete cascade,
  field text not null check (field in ('email','phone')),
  value text not null,
  source text not null check (source in ('site','email','web','profile')),
  confident boolean not null default false,
  note text,
  alternatives text[] not null default array[]::text[],
  status text not null default 'pending' check (status in ('pending','accepted','rejected')),
  created_at timestamptz not null default now(),
  decided_by uuid references public.profiles(id) on delete set null,
  decided_at timestamptz,
  unique (contact_id, field, value)
);
create index if not exists contact_finder_suggestions_pending_idx
  on public.contact_finder_suggestions (contact_id) where status = 'pending';

-- 4) Provenance and retention on the contact ---------------------------------
alter table public.crm_contacts
  add column if not exists data_source_note text,
  add column if not exists lawful_basis text
    check (lawful_basis in ('legitimate_interest','consent','existing_relationship')),
  add column if not exists found_at timestamptz,             -- first time a finder value was accepted; never reset
  add column if not exists retention_expires_at timestamptz;

create index if not exists crm_contacts_retention_idx
  on public.crm_contacts (retention_expires_at) where retention_expires_at is not null;

-- 5) Retention setting (months) ----------------------------------------------
alter table public.marketing_settings
  add column if not exists finder_retention_months int not null default 12
    check (finder_retention_months between 1 and 60);

-- 6) RLS: staff read; no client writes (service role only) --------------------
alter table public.email_domain_patterns enable row level security;
alter table public.contact_lookups enable row level security;
alter table public.contact_finder_suggestions enable row level security;

drop policy if exists "email_domain_patterns_select_staff" on public.email_domain_patterns;
create policy "email_domain_patterns_select_staff"
  on public.email_domain_patterns for select to authenticated
  using (public.is_staff());

drop policy if exists "contact_lookups_select_staff" on public.contact_lookups;
create policy "contact_lookups_select_staff"
  on public.contact_lookups for select to authenticated
  using (public.is_staff());

drop policy if exists "contact_finder_suggestions_select_staff" on public.contact_finder_suggestions;
create policy "contact_finder_suggestions_select_staff"
  on public.contact_finder_suggestions for select to authenticated
  using (public.is_staff());
