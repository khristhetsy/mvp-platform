-- Operations tasks — lightweight tasks attached to any record (company, investor,
-- diligence engagement…). Assign, edit, complete, archive. Service-role only
-- (RLS on, no policy) since all access goes through admin API routes.

create table if not exists public.ops_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  entity_type text not null,
  entity_id text not null,
  assignee_id uuid references public.profiles(id) on delete set null,
  due_date date,
  status text not null default 'open' check (status in ('open','in_progress','done')),
  created_by uuid references public.profiles(id) on delete set null,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ops_tasks_entity on public.ops_tasks (entity_type, entity_id) where archived = false;

alter table public.ops_tasks enable row level security;
