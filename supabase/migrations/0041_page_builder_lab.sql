-- Page Builder Lab (Phase 1): draft layouts only — no production page wiring.

alter table public.profiles
  add column if not exists is_super_admin boolean not null default false;

create or replace function public.is_super_admin_user(target_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select p.is_super_admin or lower(p.role) = 'super_admin'
      from public.profiles p
      where p.id = target_user_id
    ),
    false
  );
$$;

create table if not exists public.page_builder_drafts (
  id uuid primary key default gen_random_uuid(),
  page_slug text not null unique,
  layout jsonb not null default '{"version":1,"pageSlug":"","blocks":[]}'::jsonb,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.page_builder_snapshots (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.page_builder_drafts(id) on delete cascade,
  page_slug text not null,
  layout jsonb not null,
  label text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists page_builder_snapshots_draft_id_idx
  on public.page_builder_snapshots (draft_id, created_at desc);

alter table public.page_builder_drafts enable row level security;
alter table public.page_builder_snapshots enable row level security;

drop policy if exists "page_builder_drafts_super_admin" on public.page_builder_drafts;
create policy "page_builder_drafts_super_admin"
  on public.page_builder_drafts
  for all
  to authenticated
  using (public.is_super_admin_user())
  with check (public.is_super_admin_user());

drop policy if exists "page_builder_snapshots_super_admin" on public.page_builder_snapshots;
create policy "page_builder_snapshots_super_admin"
  on public.page_builder_snapshots
  for all
  to authenticated
  using (public.is_super_admin_user())
  with check (public.is_super_admin_user());
