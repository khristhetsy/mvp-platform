create table if not exists public.founder_worksheet_submissions (
  id uuid primary key default gen_random_uuid(),
  founder_id uuid not null references public.profiles(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  module_slug text not null,
  lesson_id text not null,
  content text not null,
  submitted_at timestamptz not null default now(),
  admin_feedback text,
  feedback_given_at timestamptz,
  feedback_given_by uuid references public.profiles(id),
  unique (founder_id, company_id, module_slug, lesson_id)
);

create index if not exists founder_worksheet_submissions_module_idx
  on public.founder_worksheet_submissions (module_slug, lesson_id);

alter table public.founder_worksheet_submissions enable row level security;

drop policy if exists "founders_own_submissions" on public.founder_worksheet_submissions;
create policy "founders_own_submissions"
  on public.founder_worksheet_submissions for all to authenticated
  using (founder_id = auth.uid())
  with check (founder_id = auth.uid());

drop policy if exists "admin_read_submissions" on public.founder_worksheet_submissions;
create policy "admin_read_submissions"
  on public.founder_worksheet_submissions for select to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'analyst')));

drop policy if exists "admin_update_submissions" on public.founder_worksheet_submissions;
create policy "admin_update_submissions"
  on public.founder_worksheet_submissions for update to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'analyst')));
