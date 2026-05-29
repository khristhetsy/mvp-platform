-- Company membership (links auth.users / profiles to companies)
create table if not exists public.company_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  unique (company_id, user_id)
);

create index if not exists company_members_user_id_idx on public.company_members (user_id);
create index if not exists company_members_company_id_idx on public.company_members (company_id);

-- Backfill membership from legacy founder_id
insert into public.company_members (company_id, user_id, role)
select c.id, c.founder_id, 'owner'
from public.companies c
where c.founder_id is not null
on conflict (company_id, user_id) do nothing;

-- Document status for upload workflow
alter table public.documents
  add column if not exists status text default 'uploaded';

alter table public.documents
  add column if not exists is_approved boolean default false;

-- Enable RLS
alter table public.profiles enable row level security;
alter table public.companies enable row level security;
alter table public.company_members enable row level security;
alter table public.documents enable row level security;

-- Profiles
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select to authenticated
  using (id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert to authenticated
  with check (id = auth.uid());

-- Company membership helper
create or replace function public.user_belongs_to_company(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.company_members cm
    where cm.company_id = target_company_id
      and cm.user_id = auth.uid()
  )
  or exists (
    select 1
    from public.companies c
    where c.id = target_company_id
      and c.founder_id = auth.uid()
  );
$$;

-- Companies
drop policy if exists "companies_select_member" on public.companies;
create policy "companies_select_member"
  on public.companies for select to authenticated
  using (public.user_belongs_to_company(id));

drop policy if exists "companies_insert_founder" on public.companies;
create policy "companies_insert_founder"
  on public.companies for insert to authenticated
  with check (founder_id = auth.uid());

drop policy if exists "companies_update_member" on public.companies;
create policy "companies_update_member"
  on public.companies for update to authenticated
  using (public.user_belongs_to_company(id))
  with check (public.user_belongs_to_company(id));

-- Company members
drop policy if exists "company_members_select_own" on public.company_members;
create policy "company_members_select_own"
  on public.company_members for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "company_members_insert_own" on public.company_members;
create policy "company_members_insert_own"
  on public.company_members for insert to authenticated
  with check (user_id = auth.uid());

-- Documents
drop policy if exists "documents_select_member" on public.documents;
create policy "documents_select_member"
  on public.documents for select to authenticated
  using (public.user_belongs_to_company(company_id));

drop policy if exists "documents_insert_member" on public.documents;
create policy "documents_insert_member"
  on public.documents for insert to authenticated
  with check (
    uploaded_by = auth.uid()
    and public.user_belongs_to_company(company_id)
  );

-- Storage bucket for pitch decks
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'pitch-decks',
  'pitch-decks',
  false,
  26214400,
  array['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Path: company_id/user_id/filename
drop policy if exists "pitch_decks_select_member" on storage.objects;
create policy "pitch_decks_select_member"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'pitch-decks'
    and public.user_belongs_to_company(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "pitch_decks_insert_member" on storage.objects;
create policy "pitch_decks_insert_member"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'pitch-decks'
    and public.user_belongs_to_company(((storage.foldername(name))[1])::uuid)
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists "pitch_decks_update_member" on storage.objects;
create policy "pitch_decks_update_member"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'pitch-decks'
    and public.user_belongs_to_company(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "pitch_decks_delete_member" on storage.objects;
create policy "pitch_decks_delete_member"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'pitch-decks'
    and public.user_belongs_to_company(((storage.foldername(name))[1])::uuid)
  );
