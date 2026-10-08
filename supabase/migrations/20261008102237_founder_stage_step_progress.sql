-- Stage guide completion memory, per company and step.
--   first_visited_at: set the first time the founder opens a step from its
--     stage guide. Steps with no measurable signal (Review your progress,
--     Review your investor matches, Analyze your conversion) count as done
--     on first open.
--   completed_at: stamped the first time a step is seen done, so the guide can
--     show "Completed Oct 6, 2026" (PT) on the collapsed card.
-- Additive and idempotent. Read and written by the service role only.
create table if not exists public.founder_stage_step_progress (
  company_id uuid not null references public.companies(id) on delete cascade,
  step_href text not null,
  first_visited_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (company_id, step_href)
);

alter table public.founder_stage_step_progress enable row level security;
