-- Founder company updates for investor portfolio feeds.

create table if not exists public.company_updates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  founder_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  update_type text not null default 'investor_update' check (
    update_type in (
      'milestone',
      'fundraising',
      'product',
      'financial',
      'operational',
      'investor_update'
    )
  ),
  visibility text not null default 'draft' check (
    visibility in ('draft', 'interested_investors', 'marketplace', 'private')
  ),
  created_at timestamptz not null default now(),
  published_at timestamptz
);

create index if not exists company_updates_company_id_idx on public.company_updates (company_id);
create index if not exists company_updates_founder_id_idx on public.company_updates (founder_id);
create index if not exists company_updates_published_at_idx on public.company_updates (published_at desc nulls last);
create index if not exists company_updates_visibility_idx on public.company_updates (visibility);

alter table public.company_updates enable row level security;

drop policy if exists "company_updates_select_founder" on public.company_updates;
create policy "company_updates_select_founder"
  on public.company_updates for select to authenticated
  using (public.user_can_manage_company(company_id));

drop policy if exists "company_updates_insert_founder" on public.company_updates;
create policy "company_updates_insert_founder"
  on public.company_updates for insert to authenticated
  with check (
    founder_id = auth.uid()
    and public.user_can_manage_company(company_id)
  );

drop policy if exists "company_updates_update_founder" on public.company_updates;
create policy "company_updates_update_founder"
  on public.company_updates for update to authenticated
  using (public.user_can_manage_company(company_id) and founder_id = auth.uid())
  with check (public.user_can_manage_company(company_id) and founder_id = auth.uid());

drop policy if exists "company_updates_select_staff" on public.company_updates;
create policy "company_updates_select_staff"
  on public.company_updates for select to authenticated
  using (public.is_staff());
