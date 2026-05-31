-- SPV investor requirement document uploads (private bucket + RLS).

alter table public.spv_participation_requirements
  add column if not exists review_notes text;

-- Keep founder pitch/company docs separate from investor SPV intake files.
drop policy if exists "documents_select_member" on public.documents;
create policy "documents_select_member"
  on public.documents for select to authenticated
  using (
    public.user_belongs_to_company(company_id)
    and coalesce(document_type, '') <> 'SPV_REQUIREMENT'
  );

drop policy if exists "documents_select_investor_approved" on public.documents;
create policy "documents_select_investor_approved"
  on public.documents for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and lower(p.role) = 'investor'
    )
    and public.company_is_approved(company_id)
    and coalesce(document_type, '') <> 'SPV_REQUIREMENT'
  );

drop policy if exists "documents_select_investor_spv_own" on public.documents;
create policy "documents_select_investor_spv_own"
  on public.documents for select to authenticated
  using (
    uploaded_by = auth.uid()
    and document_type = 'SPV_REQUIREMENT'
  );

drop policy if exists "documents_insert_investor_spv" on public.documents;
create policy "documents_insert_investor_spv"
  on public.documents for insert to authenticated
  with check (
    uploaded_by = auth.uid()
    and document_type = 'SPV_REQUIREMENT'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and lower(p.role) = 'investor'
    )
  );

insert into storage.buckets (id, name, public, file_size_limit)
values ('spv-investor-documents', 'spv-investor-documents', false, 26214400)
on conflict (id) do update
set public = excluded.public, file_size_limit = excluded.file_size_limit;

-- Path: {investor_id}/{requirement_id}/{timestamp}-{filename}
drop policy if exists "spv_investor_documents_select_own_or_staff" on storage.objects;
create policy "spv_investor_documents_select_own_or_staff"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'spv-investor-documents'
    and (
      public.is_staff()
      or (storage.foldername(name))[1] = auth.uid()::text
    )
  );

drop policy if exists "spv_investor_documents_insert_own" on storage.objects;
create policy "spv_investor_documents_insert_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'spv-investor-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
