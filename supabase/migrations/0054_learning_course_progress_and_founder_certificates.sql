-- Phase 2: Founder learning progress for admin-authored courses + certificate auto issuance support.
-- Additive only. Does not change existing founder learning tables or flows.

create table if not exists public.learning_course_progress (
  id uuid primary key default gen_random_uuid(),
  founder_id uuid not null references public.profiles(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  program_id uuid not null references public.learning_programs(id) on delete cascade,
  status text not null default 'not_started' check (status in ('not_started','in_progress','completed')),
  started_at timestamptz,
  completed_at timestamptz,
  last_viewed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (founder_id, company_id, program_id)
);

create index if not exists learning_course_progress_company_idx on public.learning_course_progress (company_id);
create index if not exists learning_course_progress_founder_idx on public.learning_course_progress (founder_id);
create index if not exists learning_course_progress_program_idx on public.learning_course_progress (program_id, status);

alter table public.learning_course_progress enable row level security;

drop policy if exists "learning_course_progress_select_own" on public.learning_course_progress;
create policy "learning_course_progress_select_own"
  on public.learning_course_progress for select to authenticated
  using (founder_id = auth.uid());

drop policy if exists "learning_course_progress_insert_own" on public.learning_course_progress;
create policy "learning_course_progress_insert_own"
  on public.learning_course_progress for insert to authenticated
  with check (founder_id = auth.uid());

drop policy if exists "learning_course_progress_update_own" on public.learning_course_progress;
create policy "learning_course_progress_update_own"
  on public.learning_course_progress for update to authenticated
  using (founder_id = auth.uid())
  with check (founder_id = auth.uid());

drop policy if exists "learning_course_progress_select_staff" on public.learning_course_progress;
create policy "learning_course_progress_select_staff"
  on public.learning_course_progress for select to authenticated
  using (public.is_staff());

