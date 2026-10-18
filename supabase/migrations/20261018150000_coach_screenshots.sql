-- AI IR Coach, Step 7: Screenshot studio.
-- One row per course step. A capture script run by staff against a demo founder account fills the
-- candidate image. Founders only ever see the approved image. Images live in a private bucket and
-- are served through short lived signed links created on the server.
--
-- Access: staff (admin and analyst) read and write rows. Founders have no policy here on purpose,
-- because rows hold internal notes. The founder facing API reads approved rows with the service role
-- and returns only the image link and capture date.

create table if not exists public.coach_screenshots (
  step_key text primary key,
  course_slug text not null,
  lesson_id text not null,
  step_index integer not null check (step_index >= 0),
  step_title text not null,
  menu_path text[] not null default '{}',
  route text not null,
  control_label text,
  learning_id text,

  -- Latest capture. A candidate until staff approve it.
  image_path text,
  content_hash text,
  captured_at timestamptz,
  app_version text,
  pinned boolean not null default false,
  capture_error text,

  -- What founders see.
  approved_image_path text,
  approved_hash text,
  approved_at timestamptz,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_captured_at timestamptz,
  approved_app_version text,

  -- Staff controls.
  needs_fix boolean not null default false,
  needs_fix_note text check (needs_fix_note is null or char_length(needs_fix_note) <= 500),
  capture_requested_at timestamptz,

  updated_at timestamptz not null default now()
);

create index if not exists coach_screenshots_course_idx
  on public.coach_screenshots (course_slug, lesson_id, step_index);

drop trigger if exists coach_screenshots_touch on public.coach_screenshots;
create trigger coach_screenshots_touch
  before update on public.coach_screenshots
  for each row execute function public.touch_updated_at();

alter table public.coach_screenshots enable row level security;

drop policy if exists coach_screenshots_staff on public.coach_screenshots;
create policy coach_screenshots_staff on public.coach_screenshots
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- Private bucket, no policies: only the service role reads and writes it.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('coach-screenshots', 'coach-screenshots', false, 5242880, array['image/png'])
on conflict (id) do nothing;
