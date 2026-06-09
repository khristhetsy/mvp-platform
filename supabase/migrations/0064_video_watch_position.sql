-- Video watch position, slide decks, and admin lesson media fields.

alter table public.founder_lesson_video_assets
  add column if not exists watch_position_seconds integer default 0;

alter table public.founder_lesson_video_assets
  add column if not exists slide_deck_url text;

alter table public.founder_lesson_video_assets
  add column if not exists slide_deck_storage_path text;

alter table public.learning_lessons
  add column if not exists video_url text;

alter table public.learning_lessons
  add column if not exists slide_deck_url text;

alter table public.learning_lessons
  add column if not exists video_render_status text default 'draft';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'course-slides',
  'course-slides',
  false,
  52428800,
  array['application/pdf', 'application/vnd.openxmlformats-officedocument.presentationml.presentation']
)
on conflict (id) do update
set
  public = false,
  file_size_limit = 52428800,
  allowed_mime_types = array['application/pdf', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'];

drop policy if exists "course_slides_insert_staff" on storage.objects;
create policy "course_slides_insert_staff"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'course-slides' and public.is_staff());

drop policy if exists "course_slides_update_staff" on storage.objects;
create policy "course_slides_update_staff"
  on storage.objects for update to authenticated
  using (bucket_id = 'course-slides' and public.is_staff());

drop policy if exists "course_slides_delete_staff" on storage.objects;
create policy "course_slides_delete_staff"
  on storage.objects for delete to authenticated
  using (bucket_id = 'course-slides' and public.is_staff());

drop policy if exists "course_slides_select_staff" on storage.objects;
create policy "course_slides_select_staff"
  on storage.objects for select to authenticated
  using (bucket_id = 'course-slides' and public.is_staff());
