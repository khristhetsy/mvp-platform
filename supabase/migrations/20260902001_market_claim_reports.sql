-- Saved Market Claim Grader result so founders can re-open their graded report instead
-- of re-running the AI every visit. One row per company (latest report). Mirrors the
-- pitch_deck_analyses table exactly. Additive + idempotent.

create table if not exists public.market_claim_reports (
  company_id uuid primary key references public.companies(id) on delete cascade,
  report     jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.market_claim_reports enable row level security;

-- Founders read/write their own via the service-role API (company verified after
-- auth); staff can read directly.
drop policy if exists mcr_staff on public.market_claim_reports;
create policy mcr_staff on public.market_claim_reports
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

comment on table public.market_claim_reports is
  'Latest saved Market Claim Grader result per company.';
