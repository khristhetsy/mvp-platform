-- Investable Readiness Score: per-company AI scoring with override support
-- Scored by Claude AI across 8 factors (100 pts total)
-- Visible to investors and admins only — never to founders

create table if not exists company_readiness_scores (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references companies(id) on delete cascade,

  -- Claude-computed scores
  total_score      integer not null check (total_score >= 0 and total_score <= 100),
  factor_scores    jsonb not null default '{}',
  -- factor_scores shape: { [factorKey]: { pts: number, max: number, rating: string, aiSummary: string, subScores: [...], evidence: [...], flags: [...] } }

  -- Admin override
  override_score   integer check (override_score >= 0 and override_score <= 100),
  override_reason  text,
  overridden_by    uuid references profiles(id),
  overridden_at    timestamptz,

  -- Effective score = override_score ?? total_score
  effective_score  integer generated always as (coalesce(override_score, total_score)) stored,

  -- Metadata
  scored_by        text not null default 'claude',
  score_version    integer not null default 1,
  document_count   integer not null default 0,
  outreach_unlocked boolean not null default false,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Index for fast latest-score lookup per company
create index if not exists company_readiness_scores_company_id_created_at_idx
  on company_readiness_scores(company_id, created_at desc);

-- RLS: only admin/analyst/investor roles can read; founders cannot
alter table company_readiness_scores enable row level security;

drop policy if exists "admin_analyst_full_access" on company_readiness_scores;
create policy "admin_analyst_full_access" on company_readiness_scores
  for all
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.role in ('admin', 'analyst')
    )
  );

drop policy if exists "investor_read" on company_readiness_scores;
create policy "investor_read" on company_readiness_scores
  for select
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.role = 'investor'
    )
  );

-- updated_at trigger
create or replace function update_company_readiness_scores_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger company_readiness_scores_updated_at
  before update on company_readiness_scores
  for each row execute function update_company_readiness_scores_updated_at();
