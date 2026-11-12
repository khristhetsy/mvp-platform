-- SPV client type on a company. Separate from organizations.type (founder or spv,
-- shown as "Deal Company"). Only SPV clients show a raise amount to investors.
-- Set only by super admins, because the client may sign the SPV agreement outside iCapOS.
alter table public.companies
  add column if not exists client_type text not null default 'standard'
  check (client_type in ('standard', 'spv'));

-- Every change is logged. Server only: the route uses the service role.
create table if not exists public.company_client_type_log (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  from_type text not null,
  to_type text not null,
  changed_by uuid references public.profiles(id) on delete set null,
  changed_at timestamptz not null default now()
);

create index if not exists company_client_type_log_company_idx
  on public.company_client_type_log (company_id, changed_at desc);

-- RLS on, no policies: no role but the service role can read or write the log.
alter table public.company_client_type_log enable row level security;
