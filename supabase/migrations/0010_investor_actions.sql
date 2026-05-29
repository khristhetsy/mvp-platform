-- Investor action tables: interests, intro requests, saved deals.

alter table public.investor_interests
  add column if not exists company_id uuid references public.companies(id),
  add column if not exists updated_at timestamptz default now();

update public.investor_interests ii
set company_id = c.company_id
from public.campaigns c
where ii.campaign_id = c.id
  and ii.company_id is null;

create table if not exists public.intro_requests (
  id uuid primary key default gen_random_uuid(),
  investor_id uuid not null references public.profiles(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null,
  message text,
  status text not null default 'requested',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.saved_deals (
  id uuid primary key default gen_random_uuid(),
  investor_id uuid not null references public.profiles(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null,
  status text not null default 'saved',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (investor_id, company_id)
);

create index if not exists investor_interests_investor_id_idx on public.investor_interests (investor_id);
create index if not exists investor_interests_company_id_idx on public.investor_interests (company_id);
create index if not exists intro_requests_investor_id_idx on public.intro_requests (investor_id);
create index if not exists intro_requests_company_id_idx on public.intro_requests (company_id);
create index if not exists saved_deals_investor_id_idx on public.saved_deals (investor_id);
create index if not exists saved_deals_company_id_idx on public.saved_deals (company_id);

create unique index if not exists investor_interests_investor_company_unique_idx
  on public.investor_interests (investor_id, company_id)
  where company_id is not null;

create or replace function public.is_investor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and lower(p.role) = 'investor'
  );
$$;

create or replace function public.investor_owns_company(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.companies c
    where c.id = target_company_id
      and c.founder_id = auth.uid()
  );
$$;

alter table public.investor_interests enable row level security;
alter table public.intro_requests enable row level security;
alter table public.saved_deals enable row level security;

-- investor_interests
drop policy if exists "investor_interests_select_own" on public.investor_interests;
create policy "investor_interests_select_own"
  on public.investor_interests for select to authenticated
  using (investor_id = auth.uid() and public.is_investor());

drop policy if exists "investor_interests_insert_own" on public.investor_interests;
create policy "investor_interests_insert_own"
  on public.investor_interests for insert to authenticated
  with check (
    investor_id = auth.uid()
    and public.is_investor()
    and company_id is not null
    and not public.investor_owns_company(company_id)
  );

drop policy if exists "investor_interests_update_own" on public.investor_interests;
create policy "investor_interests_update_own"
  on public.investor_interests for update to authenticated
  using (investor_id = auth.uid() and public.is_investor())
  with check (
    investor_id = auth.uid()
    and public.is_investor()
    and not public.investor_owns_company(company_id)
  );

drop policy if exists "investor_interests_select_staff" on public.investor_interests;
create policy "investor_interests_select_staff"
  on public.investor_interests for select to authenticated
  using (public.is_staff());

drop policy if exists "investor_interests_select_founder_company" on public.investor_interests;
create policy "investor_interests_select_founder_company"
  on public.investor_interests for select to authenticated
  using (
    exists (
      select 1 from public.companies c
      where c.id = company_id and c.founder_id = auth.uid()
    )
  );

-- intro_requests
drop policy if exists "intro_requests_select_own" on public.intro_requests;
create policy "intro_requests_select_own"
  on public.intro_requests for select to authenticated
  using (investor_id = auth.uid() and public.is_investor());

drop policy if exists "intro_requests_insert_own" on public.intro_requests;
create policy "intro_requests_insert_own"
  on public.intro_requests for insert to authenticated
  with check (
    investor_id = auth.uid()
    and public.is_investor()
    and not public.investor_owns_company(company_id)
  );

drop policy if exists "intro_requests_select_staff" on public.intro_requests;
create policy "intro_requests_select_staff"
  on public.intro_requests for select to authenticated
  using (public.is_staff());

drop policy if exists "intro_requests_select_founder_company" on public.intro_requests;
create policy "intro_requests_select_founder_company"
  on public.intro_requests for select to authenticated
  using (
    exists (
      select 1 from public.companies c
      where c.id = company_id and c.founder_id = auth.uid()
    )
  );

-- saved_deals
drop policy if exists "saved_deals_select_own" on public.saved_deals;
create policy "saved_deals_select_own"
  on public.saved_deals for select to authenticated
  using (investor_id = auth.uid() and public.is_investor());

drop policy if exists "saved_deals_insert_own" on public.saved_deals;
create policy "saved_deals_insert_own"
  on public.saved_deals for insert to authenticated
  with check (
    investor_id = auth.uid()
    and public.is_investor()
    and not public.investor_owns_company(company_id)
  );

drop policy if exists "saved_deals_update_own" on public.saved_deals;
create policy "saved_deals_update_own"
  on public.saved_deals for update to authenticated
  using (investor_id = auth.uid() and public.is_investor())
  with check (
    investor_id = auth.uid()
    and public.is_investor()
    and not public.investor_owns_company(company_id)
  );

drop policy if exists "saved_deals_select_staff" on public.saved_deals;
create policy "saved_deals_select_staff"
  on public.saved_deals for select to authenticated
  using (public.is_staff());

drop policy if exists "saved_deals_select_founder_company" on public.saved_deals;
create policy "saved_deals_select_founder_company"
  on public.saved_deals for select to authenticated
  using (
    exists (
      select 1 from public.companies c
      where c.id = company_id and c.founder_id = auth.uid()
    )
  );
