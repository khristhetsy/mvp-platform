-- Institutional learning hierarchy: programs, lesson-level progress, quiz attempts.

create table if not exists public.learning_programs (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text not null,
  readiness_focus text not null,
  order_index integer not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.learning_program_modules (
  program_id uuid not null references public.learning_programs(id) on delete cascade,
  module_id uuid not null references public.learning_modules(id) on delete cascade,
  order_index integer not null default 0,
  primary key (program_id, module_id)
);

create table if not exists public.founder_lesson_progress (
  id uuid primary key default gen_random_uuid(),
  founder_id uuid not null references public.profiles(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  module_slug text not null,
  lesson_id text not null,
  status text not null default 'not_started' check (
    status in ('not_started', 'in_progress', 'completed')
  ),
  quiz_score integer,
  quiz_passed boolean,
  completed_at timestamptz,
  last_viewed_at timestamptz,
  unique (founder_id, company_id, module_slug, lesson_id)
);

create table if not exists public.founder_quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  founder_id uuid not null references public.profiles(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  module_slug text not null,
  lesson_id text not null,
  score integer not null check (score >= 0 and score <= 100),
  passed boolean not null default false,
  answers jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists learning_program_modules_program_idx on public.learning_program_modules (program_id, order_index);
create index if not exists founder_lesson_progress_company_idx on public.founder_lesson_progress (company_id);
create index if not exists founder_lesson_progress_founder_idx on public.founder_lesson_progress (founder_id);
create index if not exists founder_quiz_attempts_founder_idx on public.founder_quiz_attempts (founder_id, created_at desc);

alter table public.learning_programs enable row level security;
alter table public.learning_program_modules enable row level security;
alter table public.founder_lesson_progress enable row level security;
alter table public.founder_quiz_attempts enable row level security;

drop policy if exists "learning_programs_select_published" on public.learning_programs;
create policy "learning_programs_select_published"
  on public.learning_programs for select to authenticated
  using (is_published = true or public.is_staff());

drop policy if exists "learning_program_modules_select_published" on public.learning_program_modules;
create policy "learning_program_modules_select_published"
  on public.learning_program_modules for select to authenticated
  using (
    public.is_staff()
    or exists (
      select 1
      from public.learning_programs p
      where p.id = program_id and p.is_published = true
    )
  );

drop policy if exists "founder_lesson_progress_select_own" on public.founder_lesson_progress;
create policy "founder_lesson_progress_select_own"
  on public.founder_lesson_progress for select to authenticated
  using (founder_id = auth.uid());

drop policy if exists "founder_lesson_progress_insert_own" on public.founder_lesson_progress;
create policy "founder_lesson_progress_insert_own"
  on public.founder_lesson_progress for insert to authenticated
  with check (founder_id = auth.uid());

drop policy if exists "founder_lesson_progress_update_own" on public.founder_lesson_progress;
create policy "founder_lesson_progress_update_own"
  on public.founder_lesson_progress for update to authenticated
  using (founder_id = auth.uid())
  with check (founder_id = auth.uid());

drop policy if exists "founder_lesson_progress_select_staff" on public.founder_lesson_progress;
create policy "founder_lesson_progress_select_staff"
  on public.founder_lesson_progress for select to authenticated
  using (public.is_staff());

drop policy if exists "founder_quiz_attempts_select_own" on public.founder_quiz_attempts;
create policy "founder_quiz_attempts_select_own"
  on public.founder_quiz_attempts for select to authenticated
  using (founder_id = auth.uid());

drop policy if exists "founder_quiz_attempts_insert_own" on public.founder_quiz_attempts;
create policy "founder_quiz_attempts_insert_own"
  on public.founder_quiz_attempts for insert to authenticated
  with check (founder_id = auth.uid());

drop policy if exists "founder_quiz_attempts_select_staff" on public.founder_quiz_attempts;
create policy "founder_quiz_attempts_select_staff"
  on public.founder_quiz_attempts for select to authenticated
  using (public.is_staff());

insert into public.learning_programs (slug, title, description, readiness_focus, order_index)
values
  ('investor-readiness-foundations', 'Investor Readiness Foundations', 'Core profile, narrative, and screening readiness for institutional investors.', 'foundation', 10),
  ('data-room-readiness', 'Data Room Readiness', 'Document room structure, completeness, and diligence preparation.', 'documents', 20),
  ('financial-readiness', 'Financial Readiness', 'Projections, unit economics, and capital planning for investor review.', 'financials', 30),
  ('governance-readiness', 'Governance Readiness', 'Corporate hygiene, cap table, and governance artifacts.', 'governance', 40),
  ('fundraising-operations', 'Fundraising Operations', 'Raise planning, outreach operations, and pipeline discipline.', 'capital', 50),
  ('investor-communication', 'Investor Communication', 'Updates, follow-up, and meeting preparation for institutional relationships.', 'engagement', 60),
  ('institutional-reporting', 'Institutional Reporting', 'KPI cadence and reporting systems for ongoing investor trust.', 'reporting', 70),
  ('capital-strategy', 'Capital Strategy', 'Long-horizon capital planning and institutional maturity.', 'institutional', 80)
on conflict (slug) do nothing;

insert into public.learning_program_modules (program_id, module_id, order_index)
select p.id, m.id, row_number() over (partition by p.id order by m.order_index) * 10
from public.learning_programs p
join public.learning_modules m on (
  (p.slug = 'investor-readiness-foundations' and m.slug in (
    'investor-ready-company-profiles', 'writing-strong-company-descriptions', 'startup-storytelling', 'pitch-deck-fundamentals'
  ))
  or (p.slug = 'data-room-readiness' and m.slug in ('investor-materials', 'due-diligence-preparation', 'compliance-readiness'))
  or (p.slug = 'financial-readiness' and m.slug in ('financial-projections', 'capital-raise-strategy'))
  or (p.slug = 'governance-readiness' and m.slug in ('governance-basics', 'board-readiness'))
  or (p.slug = 'fundraising-operations' and m.slug in ('investor-outreach', 'follow-up-strategy', 'negotiation-fundamentals', 'spvs-structured-capital'))
  or (p.slug = 'investor-communication' and m.slug in ('investor-updates', 'meeting-preparation', 'investor-psychology'))
  or (p.slug = 'institutional-reporting' and m.slug in ('reporting-systems', 'institutional-diligence'))
  or (p.slug = 'capital-strategy' and m.slug in ('long-term-capital-strategy'))
)
on conflict do nothing;
