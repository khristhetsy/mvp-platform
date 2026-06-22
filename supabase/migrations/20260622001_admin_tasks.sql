-- Migration: 20260622001_admin_tasks.sql
-- Admin-only task tracker with attachments (admin_tasks, admin_task_attachments, admin_task_activity).
-- ADJUSTED FROM SPEC: gated with the EXISTING public.is_staff() (admin/analyst) instead of
-- redefining is_admin() — your repo's is_admin() is an RBAC function and must not be clobbered.

-- ── enums (idempotent) ──────────────────────────────────────────────────────
do $$ begin create type task_status as enum ('todo','in_progress','review','done'); exception when duplicate_object then null; end $$;
do $$ begin create type task_priority as enum ('high','medium','low'); exception when duplicate_object then null; end $$;
do $$ begin create type task_visibility as enum ('admin_only','admin_assigned'); exception when duplicate_object then null; end $$;
do $$ begin create type task_activity_event as enum
  ('created','updated','status_changed','priority_changed',
   'attachment_added','attachment_removed','comment_added','archived','reopened'); exception when duplicate_object then null; end $$;

-- ── tables ──────────────────────────────────────────────────────────────────
create table if not exists public.admin_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 200),
  description text,
  status task_status not null default 'todo',
  priority task_priority not null default 'medium',
  assignee_id uuid references public.profiles(id) on delete set null,
  owner_label text,
  due_date date,
  visibility task_visibility not null default 'admin_only',
  tags text[] not null default '{}',
  position double precision not null default 0,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);
create index if not exists admin_tasks_status_idx on public.admin_tasks(status) where archived_at is null;
create index if not exists admin_tasks_assignee_idx on public.admin_tasks(assignee_id);
create index if not exists admin_tasks_tags_idx on public.admin_tasks using gin(tags);

create table if not exists public.admin_task_attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.admin_tasks(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null,
  source_format text not null check (source_format in ('pdf','docx','pptx')),
  converted_to_pdf boolean not null default false,
  original_storage_path text,
  uploaded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists admin_task_attachments_task_idx on public.admin_task_attachments(task_id);

create table if not exists public.admin_task_activity (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.admin_tasks(id) on delete cascade,
  actor_id uuid not null references public.profiles(id),
  event_type task_activity_event not null,
  payload jsonb not null default '{}',
  comment_text text,
  created_at timestamptz not null default now()
);
create index if not exists admin_task_activity_task_idx on public.admin_task_activity(task_id, created_at);

-- ── updated_at trigger (reuse if touch_updated_at already exists) ────────────
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists admin_tasks_touch on public.admin_tasks;
create trigger admin_tasks_touch before update on public.admin_tasks
for each row execute function public.touch_updated_at();

-- ── RLS (gated by existing public.is_staff()) ───────────────────────────────
alter table public.admin_tasks            enable row level security;
alter table public.admin_task_attachments enable row level security;
alter table public.admin_task_activity    enable row level security;

drop policy if exists admin_tasks_all on public.admin_tasks;
create policy admin_tasks_all on public.admin_tasks
  for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists admin_task_attachments_all on public.admin_task_attachments;
create policy admin_task_attachments_all on public.admin_task_attachments
  for all using (public.is_staff()) with check (public.is_staff());

drop policy if exists admin_task_activity_all on public.admin_task_activity;
create policy admin_task_activity_all on public.admin_task_activity
  for all using (public.is_staff()) with check (public.is_staff());

-- ── storage bucket + policies (private, staff-only) ─────────────────────────
insert into storage.buckets (id, name, public)
values ('admin-task-files','admin-task-files', false)
on conflict (id) do nothing;

drop policy if exists "admin read task files" on storage.objects;
create policy "admin read task files"   on storage.objects for select using (bucket_id='admin-task-files' and public.is_staff());
drop policy if exists "admin write task files" on storage.objects;
create policy "admin write task files"  on storage.objects for insert with check (bucket_id='admin-task-files' and public.is_staff());
drop policy if exists "admin update task files" on storage.objects;
create policy "admin update task files" on storage.objects for update using (bucket_id='admin-task-files' and public.is_staff());
drop policy if exists "admin delete task files" on storage.objects;
create policy "admin delete task files" on storage.objects for delete using (bucket_id='admin-task-files' and public.is_staff());
