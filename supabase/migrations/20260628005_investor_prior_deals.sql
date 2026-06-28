-- ============================================================
-- Investor prior deals (Stage 2 — track record)
-- Self-reported prior investments. Each is verified individually by staff;
-- only verified deals feed the Partner Score and show on the investor's
-- profile (when show_track_record is on).
-- ============================================================

create table if not exists public.investor_prior_deals (
  id                  uuid        primary key default gen_random_uuid(),
  investor_profile_id uuid        not null references public.investor_profiles(id) on delete cascade,
  company_name        text        not null,
  stage               text,
  year                integer,
  amount              numeric(14,2),
  proof_document_id   uuid        references public.investor_kyc_documents(id) on delete set null,
  verified            boolean     not null default false,
  verified_at         timestamptz,
  verified_by         uuid        references auth.users(id),
  created_at          timestamptz not null default now()
);

create index if not exists investor_prior_deals_profile_idx
  on public.investor_prior_deals (investor_profile_id);

alter table public.investor_prior_deals enable row level security;

-- Owner (the investor) can manage their own deals; staff can see/verify all.
drop policy if exists "investor_prior_deals_owner" on public.investor_prior_deals;
create policy "investor_prior_deals_owner"
  on public.investor_prior_deals
  for all
  to authenticated
  using (
    exists (
      select 1 from public.investor_profiles ip
       where ip.id = investor_prior_deals.investor_profile_id
         and ip.profile_id = auth.uid()
    )
    or public.is_staff()
  )
  with check (
    exists (
      select 1 from public.investor_profiles ip
       where ip.id = investor_prior_deals.investor_profile_id
         and ip.profile_id = auth.uid()
    )
    or public.is_staff()
  );

-- Whether the investor's verified track record is shown on their profile to founders.
alter table public.investor_profiles
  add column if not exists show_track_record boolean not null default true;
