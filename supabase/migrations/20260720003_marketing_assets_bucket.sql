-- Public bucket for images embedded in marketing email templates.
--
-- This bucket MUST stay public: email clients (Gmail, Outlook, Apple Mail) fetch
-- <img src> anonymously with no session, so signed URLs would render as broken
-- images for every recipient. Writes are staff-only via the policies below.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'marketing-assets',
  'marketing-assets',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

drop policy if exists "marketing_assets_insert_staff" on storage.objects;
create policy "marketing_assets_insert_staff"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'marketing-assets' and public.is_staff());

drop policy if exists "marketing_assets_update_staff" on storage.objects;
create policy "marketing_assets_update_staff"
  on storage.objects for update to authenticated
  using (bucket_id = 'marketing-assets' and public.is_staff());

drop policy if exists "marketing_assets_delete_staff" on storage.objects;
create policy "marketing_assets_delete_staff"
  on storage.objects for delete to authenticated
  using (bucket_id = 'marketing-assets' and public.is_staff());
