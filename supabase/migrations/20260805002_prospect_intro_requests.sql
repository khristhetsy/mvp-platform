-- Brokered intro requests: when a founder requests an introduction to a matched
-- CRM prospect investor (not a platform user), it lands here for the iCapOS team
-- to broker. Distinct from intro_requests, which reference a registered investor.
--
-- Additive + idempotent — safe to apply on staging first, then production.

create table if not exists public.prospect_intro_requests (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  founder_id   uuid not null references public.profiles(id) on delete cascade,
  investor_ref text not null,
  status       text not null default 'new' check (status in ('new', 'contacted', 'dismissed')),
  note         text,
  handled_by   uuid references public.profiles(id) on delete set null,
  handled_at   timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (company_id, investor_ref)
);

create index if not exists pir_status_idx  on public.prospect_intro_requests (status);
create index if not exists pir_company_idx on public.prospect_intro_requests (company_id);

comment on table public.prospect_intro_requests is
  'Founder→prospect-investor introduction requests from the Matching Center, brokered by staff.';

alter table public.prospect_intro_requests enable row level security;

-- Staff only (founders create via service role in the API).
drop policy if exists pir_staff_all on public.prospect_intro_requests;
create policy pir_staff_all on public.prospect_intro_requests
  for all using (public.is_staff()) with check (public.is_staff());
