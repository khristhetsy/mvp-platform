-- Admin overrides for static founder lesson content (modules.ts defaults).

create table if not exists public.learning_lesson_content (
  id uuid primary key default gen_random_uuid(),
  module_slug text not null,
  lesson_id text not null,
  title text,
  summary text,
  key_points jsonb,
  worksheet_prompt text,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (module_slug, lesson_id)
);

create index if not exists learning_lesson_content_module_idx
  on public.learning_lesson_content (module_slug);

alter table public.learning_lesson_content enable row level security;

drop policy if exists "learning_lesson_content_select_authenticated" on public.learning_lesson_content;
create policy "learning_lesson_content_select_authenticated"
  on public.learning_lesson_content for select to authenticated
  using (true);

drop policy if exists "learning_lesson_content_staff_write" on public.learning_lesson_content;
create policy "learning_lesson_content_staff_write"
  on public.learning_lesson_content for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());
