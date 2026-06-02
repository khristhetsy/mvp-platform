-- Founder/company document replacement + safe RLS tightening.
-- Allows company owner/admin (and legacy founder_id) to replace/archive their own company docs.
-- Keeps SPV_REQUIREMENT documents inaccessible to founders.

-- Insert: allow upload only for managers, and never for SPV_REQUIREMENT.
drop policy if exists "documents_insert_member" on public.documents;
create policy "documents_insert_member"
  on public.documents for insert to authenticated
  with check (
    uploaded_by = auth.uid()
    and public.user_can_manage_company(company_id)
    and coalesce(document_type, '') <> 'SPV_REQUIREMENT'
  );

-- Update: allow archiving/replacing for managers, and never for SPV_REQUIREMENT.
drop policy if exists "documents_update_member" on public.documents;
create policy "documents_update_member"
  on public.documents for update to authenticated
  using (
    public.user_can_manage_company(company_id)
    and coalesce(document_type, '') <> 'SPV_REQUIREMENT'
  )
  with check (
    public.user_can_manage_company(company_id)
    and coalesce(document_type, '') <> 'SPV_REQUIREMENT'
  );

