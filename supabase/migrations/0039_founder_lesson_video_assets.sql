-- AI video lesson assets per founder/company/lesson (script, slides, captions; video URL placeholder).

create table if not exists public.founder_lesson_video_assets (
  id uuid primary key default gen_random_uuid(),
  founder_id uuid not null references public.profiles(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  course_slug text not null,
  lesson_slug text not null,
  script text,
  narration_text text,
  captions text,
  slides_json jsonb not null default '[]'::jsonb,
  video_url text,
  render_status text not null default 'draft' check (
    render_status in ('draft', 'script_ready', 'rendering', 'ready', 'failed')
  ),
  provider text not null default 'manual' check (
    provider in ('manual', 'openai', 'remotion', 'elevenlabs', 'heygen')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (founder_id, company_id, course_slug, lesson_slug)
);

create index if not exists founder_lesson_video_assets_founder_idx
  on public.founder_lesson_video_assets (founder_id, course_slug, lesson_slug);

alter table public.founder_lesson_video_assets enable row level security;

drop policy if exists "founder_lesson_video_assets_select_own" on public.founder_lesson_video_assets;
create policy "founder_lesson_video_assets_select_own"
  on public.founder_lesson_video_assets for select to authenticated
  using (founder_id = auth.uid());

drop policy if exists "founder_lesson_video_assets_insert_own" on public.founder_lesson_video_assets;
create policy "founder_lesson_video_assets_insert_own"
  on public.founder_lesson_video_assets for insert to authenticated
  with check (founder_id = auth.uid());

drop policy if exists "founder_lesson_video_assets_update_own" on public.founder_lesson_video_assets;
create policy "founder_lesson_video_assets_update_own"
  on public.founder_lesson_video_assets for update to authenticated
  using (founder_id = auth.uid())
  with check (founder_id = auth.uid());

drop policy if exists "founder_lesson_video_assets_select_staff" on public.founder_lesson_video_assets;
create policy "founder_lesson_video_assets_select_staff"
  on public.founder_lesson_video_assets for select to authenticated
  using (public.is_staff());
