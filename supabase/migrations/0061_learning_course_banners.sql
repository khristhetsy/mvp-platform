-- Course banner images for admin-authored learning programs.

alter table public.learning_programs
  add column if not exists banner_image_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'course-banners',
  'course-banners',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "course_banners_insert_staff" on storage.objects;
create policy "course_banners_insert_staff"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'course-banners' and public.is_staff());

drop policy if exists "course_banners_update_staff" on storage.objects;
create policy "course_banners_update_staff"
  on storage.objects for update to authenticated
  using (bucket_id = 'course-banners' and public.is_staff());

drop policy if exists "course_banners_delete_staff" on storage.objects;
create policy "course_banners_delete_staff"
  on storage.objects for delete to authenticated
  using (bucket_id = 'course-banners' and public.is_staff());
