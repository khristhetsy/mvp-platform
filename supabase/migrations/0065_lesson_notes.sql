create table if not exists public.founder_lesson_notes (
  id uuid primary key default gen_random_uuid(),
  founder_id uuid not null references public.profiles(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  module_slug text not null,
  lesson_id text not null,
  content text not null default '',
  updated_at timestamptz not null default now(),
  unique (founder_id, company_id, module_slug, lesson_id)
);

create index if not exists founder_lesson_notes_founder_idx on public.founder_lesson_notes (founder_id, company_id);

alter table public.founder_lesson_notes enable row level security;

drop policy if exists "founders_own_notes" on public.founder_lesson_notes;
create policy "founders_own_notes"
  on public.founder_lesson_notes for all to authenticated
  using (founder_id = auth.uid())
  with check (founder_id = auth.uid());
