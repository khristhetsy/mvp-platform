-- Founder Premium plan: records each founder's check mark acceptance of the iCFO
-- Services Agreement before checkout (Nov 12, 2026). There is no signature; the
-- row is the record: who accepted, for which company, which agreement text
-- (agreement_version), and when. Inserts happen only through the service role
-- in /api/billing/premium-agreement/accept. Founders can read their own rows,
-- staff can read all. Nobody can edit or delete a row through the API.

create table if not exists public.premium_agreement_acceptances (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  company_id uuid,
  plan_type text not null default 'founder_premium',
  agreement_version text not null,
  company_name text not null,
  company_address text not null,
  company_email text not null,
  accepted_name text not null,
  accepted_title text not null,
  accepted_at timestamptz not null,
  user_agent text,
  pdf_sha256 text
);

alter table public.premium_agreement_acceptances enable row level security;

drop policy if exists "founder_read_own_premium_agreement" on public.premium_agreement_acceptances;
create policy "founder_read_own_premium_agreement" on public.premium_agreement_acceptances
  for select using (profile_id = auth.uid());

drop policy if exists "staff_read_premium_agreement" on public.premium_agreement_acceptances;
create policy "staff_read_premium_agreement" on public.premium_agreement_acceptances
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','analyst'))
  );

create index if not exists premium_agreement_acceptances_profile_idx
  on public.premium_agreement_acceptances (profile_id, agreement_version, accepted_at desc);
