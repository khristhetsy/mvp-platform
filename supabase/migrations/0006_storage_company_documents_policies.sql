-- Upload readiness hardening for canonical company-documents bucket.
-- Keeps bucket private, adds member-based policies without disabling RLS.

insert into storage.buckets (id, name, public)
values ('company-documents', 'company-documents', false)
on conflict (id) do update
set public = false;

-- company-documents object path: {company_id}/{document_type}/{uuid}-{filename}
-- company_id is folder segment 1.

drop policy if exists "company_documents_select_member" on storage.objects;
create policy "company_documents_select_member"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'company-documents'
    and public.user_belongs_to_company(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "company_documents_insert_member" on storage.objects;
create policy "company_documents_insert_member"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'company-documents'
    and public.user_belongs_to_company(((storage.foldername(name))[1])::uuid)
  );

-- Optional: only owners/admins can update/delete. (Requires 0005 for user_can_manage_company().)
drop policy if exists "company_documents_update_manager" on storage.objects;
create policy "company_documents_update_manager"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'company-documents'
    and public.user_can_manage_company(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "company_documents_delete_manager" on storage.objects;
create policy "company_documents_delete_manager"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'company-documents'
    and public.user_can_manage_company(((storage.foldername(name))[1])::uuid)
  );

