-- Stages staff add on an Investor Relations project's Tasks board with "+ Stage" (iCapOS only,
-- nothing is written to Odoo). A task placed in one of these stages shows in that column;
-- tasks without one keep their Odoo stage or their week column.
create table if not exists public.ir_task_stages (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.ir_projects(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 80),
  sequence    integer not null default 0,
  created_by  uuid,
  created_at  timestamptz not null default now()
);
create index if not exists ir_task_stages_project_idx on public.ir_task_stages (project_id, sequence);
alter table public.ir_task_stages enable row level security;
drop policy if exists ir_task_stages_staff_all on public.ir_task_stages;
create policy ir_task_stages_staff_all on public.ir_task_stages for all to authenticated using (public.is_staff()) with check (public.is_staff());

alter table public.ir_tasks add column if not exists stage_id uuid references public.ir_task_stages(id) on delete set null;
comment on column public.ir_tasks.stage_id is 'Stage added on the iCapOS Tasks board (+ Stage). Null keeps the Odoo stage or the week column.';
