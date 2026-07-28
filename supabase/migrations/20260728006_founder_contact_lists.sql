create table if not exists public.founder_contact_lists (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  contact_ids jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists founder_contact_lists_company_idx
  on public.founder_contact_lists (company_id);

alter table public.founder_contact_lists enable row level security;

drop policy if exists "founder_rw_contact_lists" on public.founder_contact_lists;
create policy "founder_rw_contact_lists" on public.founder_contact_lists
  for all to authenticated
  using (exists (select 1 from public.companies c where c.id = founder_contact_lists.company_id and c.founder_id = auth.uid()))
  with check (exists (select 1 from public.companies c where c.id = founder_contact_lists.company_id and c.founder_id = auth.uid()));
