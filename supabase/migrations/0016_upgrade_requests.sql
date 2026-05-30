-- Upgrade / billing-readiness requests (no payment provider integration).
-- Rollback: drop table public.upgrade_requests (policies drop with table).

create table if not exists public.upgrade_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  request_type text not null check (
    request_type in ('request_upgrade', 'contact_sales', 'notify_billing_live')
  ),
  requested_plan text check (
    requested_plan is null or requested_plan in (
      'founder_trial',
      'founder_basic',
      'founder_professional',
      'investor_free'
    )
  ),
  feature_key text,
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'closed')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists upgrade_requests_profile_id_idx on public.upgrade_requests (profile_id);
create index if not exists upgrade_requests_status_idx on public.upgrade_requests (status);
create index if not exists upgrade_requests_created_at_idx on public.upgrade_requests (created_at desc);

alter table public.upgrade_requests enable row level security;

drop policy if exists "upgrade_requests_insert_own" on public.upgrade_requests;
create policy "upgrade_requests_insert_own"
  on public.upgrade_requests for insert to authenticated
  with check (profile_id = auth.uid());

drop policy if exists "upgrade_requests_select_own" on public.upgrade_requests;
create policy "upgrade_requests_select_own"
  on public.upgrade_requests for select to authenticated
  using (profile_id = auth.uid());

drop policy if exists "upgrade_requests_select_staff" on public.upgrade_requests;
create policy "upgrade_requests_select_staff"
  on public.upgrade_requests for select to authenticated
  using (public.is_staff());
