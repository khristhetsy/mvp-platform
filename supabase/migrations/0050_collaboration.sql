-- Entity-based collaboration (comments, internal notes, Phase 1).
-- Rollback: drop table collaboration_comments, collaboration_threads.

create table if not exists public.collaboration_threads (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id text not null,
  company_id uuid references public.companies(id) on delete set null,
  investor_profile_id uuid references public.investor_profiles(id) on delete set null,
  spv_id uuid references public.spv_opportunities(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (entity_type, entity_id)
);

create index if not exists collaboration_threads_entity_idx
  on public.collaboration_threads (entity_type, entity_id);

create table if not exists public.collaboration_comments (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.collaboration_threads(id) on delete cascade,
  author_user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) >= 1 and char_length(body) <= 4000),
  visibility text not null default 'internal' check (
    visibility in ('admin_only', 'company_team', 'investor_related', 'internal')
  ),
  mentions jsonb not null default '[]'::jsonb,
  is_internal_note boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists collaboration_comments_thread_idx
  on public.collaboration_comments (thread_id, created_at desc);

alter table public.collaboration_threads enable row level security;
alter table public.collaboration_comments enable row level security;

drop policy if exists "collaboration_threads_staff_select" on public.collaboration_threads;
create policy "collaboration_threads_staff_select"
  on public.collaboration_threads for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'analyst')
    )
  );

drop policy if exists "collaboration_comments_staff_select" on public.collaboration_comments;
create policy "collaboration_comments_staff_select"
  on public.collaboration_comments for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'analyst')
    )
  );
