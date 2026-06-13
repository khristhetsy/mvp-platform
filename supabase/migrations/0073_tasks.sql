-- ============================================================
-- 0073_tasks.sql — Task System
-- Two use-cases:
--   1. Personal tasks: any user creates tasks for themselves
--   2. Assigned tasks: admins create tasks assigned to internal users
-- ============================================================

-- ----------------------------------------------------------
-- Table
-- ----------------------------------------------------------
create table if not exists public.tasks (
  id            uuid        primary key default gen_random_uuid(),
  title         text        not null,
  description   text,
  created_by    uuid        not null references auth.users(id) on delete cascade,
  assigned_to   uuid        references public.profiles(id) on delete set null,
  status        text        not null default 'todo'
                            check (status in ('todo', 'in_progress', 'done', 'cancelled')),
  priority      text        not null default 'medium'
                            check (priority in ('low', 'medium', 'high')),
  due_date      timestamptz,
  context_type  text        check (context_type in ('personal', 'company', 'deal', 'internal')),
  context_id    uuid,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- auto-update updated_at
create or replace function public.set_tasks_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tasks_updated_at on public.tasks;
create trigger tasks_updated_at
  before update on public.tasks
  for each row execute procedure public.set_tasks_updated_at();

-- indexes
create index if not exists tasks_created_by_idx  on public.tasks (created_by);
create index if not exists tasks_assigned_to_idx on public.tasks (assigned_to);
create index if not exists tasks_status_idx      on public.tasks (status);
create index if not exists tasks_due_date_idx    on public.tasks (due_date);

-- ----------------------------------------------------------
-- RLS
-- ----------------------------------------------------------
alter table public.tasks enable row level security;

-- Anyone can see their own tasks (created or assigned)
drop policy if exists "tasks_select_own" on public.tasks;
create policy "tasks_select_own"
  on public.tasks for select
  using (
    created_by = auth.uid()
    or assigned_to = auth.uid()
    or is_admin()
  );

-- Users can create personal tasks (created_by must be self, assigned_to must be null or self unless admin)
drop policy if exists "tasks_insert" on public.tasks;
create policy "tasks_insert"
  on public.tasks for insert
  with check (
    created_by = auth.uid()
    and (
      assigned_to is null
      or assigned_to = auth.uid()
      or is_admin()
    )
  );

-- Users can update their own tasks; admins can update any task
drop policy if exists "tasks_update" on public.tasks;
create policy "tasks_update"
  on public.tasks for update
  using (
    created_by = auth.uid()
    or assigned_to = auth.uid()
    or is_admin()
  )
  with check (
    -- non-admins cannot change assigned_to to someone else
    is_admin()
    or (assigned_to is null or assigned_to = auth.uid() or assigned_to = (select assigned_to from public.tasks where id = tasks.id))
  );

-- Only creator or admin can delete
drop policy if exists "tasks_delete" on public.tasks;
create policy "tasks_delete"
  on public.tasks for delete
  using (
    created_by = auth.uid()
    or is_admin()
  );
