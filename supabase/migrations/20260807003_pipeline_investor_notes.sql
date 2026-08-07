-- Timestamped note history for founder Investor CRM investors.
-- Additive + idempotent — safe to apply on staging first, then production.

create table if not exists public.pipeline_investor_notes (
  id                   uuid primary key default gen_random_uuid(),
  pipeline_investor_id uuid not null references public.pipeline_investors(id) on delete cascade,
  founder_id           uuid not null references public.profiles(id) on delete cascade,
  body                 text not null,
  created_at           timestamptz not null default now()
);

create index if not exists pin_investor_idx
  on public.pipeline_investor_notes (pipeline_investor_id, created_at desc);

alter table public.pipeline_investor_notes enable row level security;

drop policy if exists pin_founder_own on public.pipeline_investor_notes;
create policy pin_founder_own on public.pipeline_investor_notes
  for all to authenticated
  using (founder_id = auth.uid())
  with check (founder_id = auth.uid());

comment on table public.pipeline_investor_notes is
  'Timestamped founder notes on a pipeline investor (Investor CRM detail view).';
