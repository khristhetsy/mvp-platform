-- Prospect investors: internal, unverified investor records used to seed and test
-- the matching engine before real investors join. Admin/analyst-managed only.
-- They are NOT platform members and must stay out of founder-facing intro flows.

create table if not exists public.prospect_investors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  investor_type text,
  preferred_sectors text[] not null default '{}',
  preferred_stages text[] not null default '{}',
  preferred_geographies text[] not null default '{}',
  check_size_min numeric,
  check_size_max numeric,
  notes text,
  source text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.prospect_investors enable row level security;

drop policy if exists "staff_manage_prospect_investors" on public.prospect_investors;
create policy "staff_manage_prospect_investors" on public.prospect_investors
  for all to authenticated
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'analyst'))
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'analyst'))
  );
