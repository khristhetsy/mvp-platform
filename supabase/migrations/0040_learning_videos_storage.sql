-- Private bucket for founder-uploaded course lesson videos (MP4/WebM).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'learning-videos',
  'learning-videos',
  false,
  262144000,
  array['video/mp4', 'video/webm']
)
on conflict (id) do update
set
  public = false,
  file_size_limit = 262144000,
  allowed_mime_types = array['video/mp4', 'video/webm'];

-- Object path: {company_id}/{course_slug}/{lesson_slug}/{filename}

drop policy if exists "learning_videos_select_member" on storage.objects;
create policy "learning_videos_select_member"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'learning-videos'
    and public.user_belongs_to_company(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "learning_videos_insert_member" on storage.objects;
create policy "learning_videos_insert_member"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'learning-videos'
    and public.user_belongs_to_company(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "learning_videos_update_manager" on storage.objects;
create policy "learning_videos_update_manager"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'learning-videos'
    and public.user_can_manage_company(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "learning_videos_delete_manager" on storage.objects;
create policy "learning_videos_delete_manager"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'learning-videos'
    and public.user_can_manage_company(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "learning_videos_select_staff" on storage.objects;
create policy "learning_videos_select_staff"
  on storage.objects for select to authenticated
  using (bucket_id = 'learning-videos' and public.is_staff());
