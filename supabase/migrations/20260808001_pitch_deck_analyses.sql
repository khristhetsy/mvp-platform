-- Saved pitch-deck AI analysis so founders can Save / re-open / export it.
-- One row per company (latest analysis). Additive + idempotent.

create table if not exists public.pitch_deck_analyses (
  company_id uuid primary key references public.companies(id) on delete cascade,
  analysis   jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.pitch_deck_analyses enable row level security;

-- Founders read/write their own via the service-role API (company verified after
-- auth); staff can read directly.
drop policy if exists pda_staff on public.pitch_deck_analyses;
create policy pda_staff on public.pitch_deck_analyses
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

comment on table public.pitch_deck_analyses is
  'Latest saved pitch-deck AI analyzer result per company.';
