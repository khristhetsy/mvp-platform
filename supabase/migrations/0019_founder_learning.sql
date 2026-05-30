-- Founder adaptive learning (Phase 1 institutional readiness curriculum).
-- Rollback: drop table public.learning_progress; drop table public.learning_modules;

create table if not exists public.learning_modules (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  category text not null,
  description text not null,
  estimated_time_minutes integer not null default 15,
  difficulty text not null default 'intermediate' check (difficulty in ('introductory', 'intermediate', 'advanced')),
  related_remediation_category text,
  required_plan text not null default 'founder_professional' check (
    required_plan in ('founder_trial', 'founder_basic', 'founder_professional', 'any')
  ),
  readiness_stage text not null check (
    readiness_stage in ('foundation', 'readiness', 'capital', 'engagement', 'institutional')
  ),
  order_index integer not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.learning_progress (
  id uuid primary key default gen_random_uuid(),
  founder_id uuid not null references public.profiles(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  module_id uuid not null references public.learning_modules(id) on delete cascade,
  status text not null default 'not_started' check (
    status in ('not_started', 'in_progress', 'completed')
  ),
  percent_complete integer not null default 0 check (percent_complete >= 0 and percent_complete <= 100),
  started_at timestamptz,
  completed_at timestamptz,
  last_viewed_at timestamptz,
  unique (founder_id, company_id, module_id)
);

create index if not exists learning_modules_stage_idx on public.learning_modules (readiness_stage, order_index);
create index if not exists learning_progress_company_idx on public.learning_progress (company_id);
create index if not exists learning_progress_founder_idx on public.learning_progress (founder_id);

alter table public.learning_modules enable row level security;
alter table public.learning_progress enable row level security;

drop policy if exists "learning_modules_select_published" on public.learning_modules;
create policy "learning_modules_select_published"
  on public.learning_modules for select to authenticated
  using (is_published = true or public.is_staff());

drop policy if exists "learning_progress_select_own" on public.learning_progress;
create policy "learning_progress_select_own"
  on public.learning_progress for select to authenticated
  using (founder_id = auth.uid());

drop policy if exists "learning_progress_insert_own" on public.learning_progress;
create policy "learning_progress_insert_own"
  on public.learning_progress for insert to authenticated
  with check (founder_id = auth.uid());

drop policy if exists "learning_progress_update_own" on public.learning_progress;
create policy "learning_progress_update_own"
  on public.learning_progress for update to authenticated
  using (founder_id = auth.uid())
  with check (founder_id = auth.uid());

drop policy if exists "learning_progress_select_staff" on public.learning_progress;
create policy "learning_progress_select_staff"
  on public.learning_progress for select to authenticated
  using (public.is_staff());

insert into public.learning_modules (slug, title, category, description, estimated_time_minutes, difficulty, related_remediation_category, required_plan, readiness_stage, order_index)
values
  ('investor-ready-company-profiles', 'Investor-ready company profiles', 'Foundation', 'Structure your company profile for institutional screening and marketplace review.', 20, 'introductory', 'company_profile', 'any', 'foundation', 10),
  ('writing-strong-company-descriptions', 'Writing strong company descriptions', 'Foundation', 'Craft a concise narrative that communicates product, market, traction, and capital thesis.', 18, 'introductory', 'company_profile', 'any', 'foundation', 20),
  ('startup-storytelling', 'Startup storytelling', 'Foundation', 'Translate technical progress into investor-grade story arcs and proof points.', 22, 'intermediate', 'market', 'any', 'foundation', 30),
  ('pitch-deck-fundamentals', 'Pitch deck fundamentals', 'Foundation', 'Build a diligence-ready deck aligned with institutional expectations.', 25, 'intermediate', 'documents', 'any', 'foundation', 40),
  ('financial-projections', 'Financial projections', 'Readiness', 'Model runway, unit economics, and capital deployment for investor diligence.', 28, 'intermediate', 'financials', 'any', 'readiness', 50),
  ('governance-basics', 'Governance basics', 'Readiness', 'Establish board, cap table, and corporate hygiene expected by institutional investors.', 24, 'intermediate', 'governance', 'any', 'readiness', 60),
  ('due-diligence-preparation', 'Due diligence preparation', 'Readiness', 'Prepare materials and workflows before AI and admin diligence review.', 26, 'intermediate', 'readiness', 'any', 'readiness', 70),
  ('compliance-readiness', 'Compliance readiness', 'Readiness', 'Understand disclosure, review submission, and compliance checkpoints.', 20, 'intermediate', 'compliance', 'any', 'readiness', 80),
  ('investor-materials', 'Investor materials', 'Readiness', 'Assemble the document room and artifacts investors expect at first pass.', 22, 'intermediate', 'investor_materials', 'any', 'readiness', 90),
  ('capital-raise-strategy', 'Capital raise strategy', 'Capital preparation', 'Plan round sizing, timeline, and investor targeting for your stage.', 30, 'advanced', 'financials', 'any', 'capital', 100),
  ('investor-psychology', 'Investor psychology', 'Capital preparation', 'Understand how institutional investors evaluate risk, fit, and conviction.', 18, 'intermediate', 'market', 'any', 'capital', 110),
  ('spvs-structured-capital', 'SPVs and structured capital', 'Capital preparation', 'Learn when SPVs and structured vehicles fit your raise and governance model.', 24, 'advanced', 'financials', 'any', 'capital', 120),
  ('negotiation-fundamentals', 'Negotiation fundamentals', 'Capital preparation', 'Navigate term sheets, governance terms, and closing dynamics.', 26, 'advanced', 'governance', 'any', 'capital', 130),
  ('investor-outreach', 'Investor outreach', 'Investor engagement', 'Design credible outreach sequences for institutional and strategic investors.', 20, 'intermediate', 'investor_materials', 'any', 'engagement', 140),
  ('follow-up-strategy', 'Follow-up strategy', 'Investor engagement', 'Maintain momentum with structured follow-ups and pipeline hygiene.', 16, 'introductory', 'investor_materials', 'any', 'engagement', 150),
  ('investor-updates', 'Investor updates', 'Investor engagement', 'Publish consistent updates that build trust through the raise.', 18, 'intermediate', 'readiness', 'any', 'engagement', 160),
  ('meeting-preparation', 'Meeting preparation', 'Investor engagement', 'Prepare for partner meetings, data room walkthroughs, and IC-style reviews.', 22, 'intermediate', 'readiness', 'any', 'engagement', 170),
  ('board-readiness', 'Board readiness', 'Institutional maturity', 'Prepare governance rhythms and board materials for scaling companies.', 24, 'advanced', 'governance', 'any', 'institutional', 180),
  ('reporting-systems', 'Reporting systems', 'Institutional maturity', 'Implement KPI and financial reporting cadences investors rely on post-close.', 26, 'advanced', 'readiness', 'any', 'institutional', 190),
  ('institutional-diligence', 'Institutional diligence', 'Institutional maturity', 'Operate through deep diligence workflows used by funds and strategics.', 28, 'advanced', 'readiness', 'any', 'institutional', 200),
  ('long-term-capital-strategy', 'Long-term capital strategy', 'Institutional maturity', 'Plan follow-on rounds, debt, and strategic capital over a multi-year horizon.', 30, 'advanced', 'financials', 'any', 'institutional', 210)
on conflict (slug) do nothing;
