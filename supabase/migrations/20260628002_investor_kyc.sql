-- ============================================================
-- Investor KYC / accreditation verification (Stage 2)
-- Adds a verification stage between profile approval and full
-- access. Investors upload identity + accreditation evidence; an
-- admin verifies it. Sensitive actions now require kyc_status='verified'.
-- ============================================================

-- 1) KYC state on the investor profile -----------------------------------
alter table public.investor_profiles
  add column if not exists kyc_status text not null default 'not_started'
    check (kyc_status in ('not_started','pending','verified','rejected')),
  add column if not exists kyc_submitted_at timestamptz,
  add column if not exists kyc_reviewed_at  timestamptz,
  add column if not exists kyc_reviewed_by   uuid references auth.users(id),
  add column if not exists kyc_feedback      text;

-- Grandfather already-approved investors so the new gate doesn't lock out
-- existing accounts during the beta. Remove this backfill if you want every
-- approved investor to re-verify.
update public.investor_profiles
   set kyc_status = 'verified',
       kyc_reviewed_at = coalesce(kyc_reviewed_at, approved_at, now())
 where approval_status = 'approved'
   and kyc_status = 'not_started';

-- 2) Uploaded KYC documents ----------------------------------------------
create table if not exists public.investor_kyc_documents (
  id                  uuid        primary key default gen_random_uuid(),
  investor_profile_id uuid        not null references public.investor_profiles(id) on delete cascade,
  doc_type            text        not null,
  file_name           text        not null,
  file_path           text        not null,
  mime_type           text,
  size_bytes          integer,
  status              text        not null default 'uploaded'
    check (status in ('uploaded','archived')),
  uploaded_at         timestamptz not null default now()
);

create index if not exists investor_kyc_documents_profile_idx
  on public.investor_kyc_documents (investor_profile_id);

alter table public.investor_kyc_documents enable row level security;

-- Owner (the investor whose profile this is) can read/insert/remove their own
-- docs; staff can see everything. App writes go through service-role API routes.
drop policy if exists "investor_kyc_documents_owner" on public.investor_kyc_documents;
create policy "investor_kyc_documents_owner"
  on public.investor_kyc_documents
  for all
  to authenticated
  using (
    exists (
      select 1 from public.investor_profiles ip
       where ip.id = investor_kyc_documents.investor_profile_id
         and ip.profile_id = auth.uid()
    )
    or public.is_staff()
  )
  with check (
    exists (
      select 1 from public.investor_profiles ip
       where ip.id = investor_kyc_documents.investor_profile_id
         and ip.profile_id = auth.uid()
    )
    or public.is_staff()
  );

-- 3) Private storage bucket for KYC files --------------------------------
-- All reads/writes are mediated by API routes using the service-role client,
-- which issues short-lived signed URLs. Bucket is private (public = false).
insert into storage.buckets (id, name, public)
values ('investor-kyc', 'investor-kyc', false)
on conflict (id) do nothing;
