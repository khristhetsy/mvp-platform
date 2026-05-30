-- Investor onboarding profiles and admin approval workflow.
-- Rollback: drop table public.investor_profiles (policies drop with table).

create table if not exists public.investor_profiles (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  investor_type text,
  firm_name text,
  check_size_min numeric,
  check_size_max numeric,
  preferred_sectors text[] not null default '{}',
  preferred_geographies text[] not null default '{}',
  preferred_stages text[] not null default '{}',
  accredited_status boolean not null default false,
  investment_thesis text,
  contact_preference text,
  approval_status text not null default 'draft' check (
    approval_status in ('draft', 'submitted', 'approved', 'rejected', 'changes_requested')
  ),
  admin_feedback text,
  submitted_at timestamptz,
  approved_at timestamptz,
  approved_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists investor_profiles_approval_status_idx on public.investor_profiles (approval_status);
create index if not exists investor_profiles_submitted_at_idx on public.investor_profiles (submitted_at);

alter table public.investor_profiles enable row level security;

drop policy if exists "investor_profiles_select_own" on public.investor_profiles;
create policy "investor_profiles_select_own"
  on public.investor_profiles for select to authenticated
  using (profile_id = auth.uid());

drop policy if exists "investor_profiles_insert_own" on public.investor_profiles;
create policy "investor_profiles_insert_own"
  on public.investor_profiles for insert to authenticated
  with check (profile_id = auth.uid());

drop policy if exists "investor_profiles_update_own" on public.investor_profiles;
create policy "investor_profiles_update_own"
  on public.investor_profiles for update to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

drop policy if exists "investor_profiles_select_staff" on public.investor_profiles;
create policy "investor_profiles_select_staff"
  on public.investor_profiles for select to authenticated
  using (public.is_staff());

drop policy if exists "investor_profiles_update_staff" on public.investor_profiles;
create policy "investor_profiles_update_staff"
  on public.investor_profiles for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- Grandfather existing investors as approved so current activity is preserved.
insert into public.investor_profiles (
  profile_id,
  approval_status,
  accredited_status,
  submitted_at,
  approved_at,
  updated_at
)
select
  p.id,
  'approved',
  true,
  p.created_at,
  p.created_at,
  now()
from public.profiles p
where lower(p.role) = 'investor'
on conflict (profile_id) do nothing;
