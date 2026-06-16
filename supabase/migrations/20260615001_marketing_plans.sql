-- ============================================================
-- 20260615_marketing_plans.sql — Marketing Plan / Strategy
-- Adds a manual strategy builder + AI CMO drafts that sync to Tasks.
--   marketing_plans       — one strategy (objective, audience, window)
--   marketing_plan_items  — initiatives within a plan, each can sync
--                           to a row in public.tasks
-- Also extends tasks.context_type to allow linking a task back to a plan.
-- Rollback:
--   drop table public.marketing_plan_items;
--   drop table public.marketing_plans;
--   (and restore the original tasks.context_type check constraint)
-- ============================================================

-- ----------------------------------------------------------
-- marketing_plans
-- ----------------------------------------------------------
create table if not exists public.marketing_plans (
  id              uuid        primary key default gen_random_uuid(),
  name            text        not null,
  objective       text,
  summary         text,
  target_audience text,
  budget          text,
  status          text        not null default 'draft'
                              check (status in ('draft', 'active', 'archived')),
  start_date      date,
  end_date        date,
  generated_by    text        not null default 'manual'
                              check (generated_by in ('manual', 'claude')),
  created_by      uuid        references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ----------------------------------------------------------
-- marketing_plan_items (initiatives)
-- ----------------------------------------------------------
create table if not exists public.marketing_plan_items (
  id           uuid        primary key default gen_random_uuid(),
  plan_id      uuid        not null references public.marketing_plans(id) on delete cascade,
  title        text        not null,
  description  text,
  channel      text        not null default 'other'
                           check (channel in (
                             'email', 'content', 'social', 'paid',
                             'events', 'pr', 'seo', 'partnerships', 'other'
                           )),
  status       text        not null default 'planned'
                           check (status in ('planned', 'in_progress', 'done')),
  priority     text        not null default 'medium'
                           check (priority in ('low', 'medium', 'high')),
  start_date   date,
  due_date     date,
  sort_order   integer     not null default 0,
  task_id      uuid        references public.tasks(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ----------------------------------------------------------
-- updated_at triggers (reuse pattern from 0073_tasks.sql)
-- ----------------------------------------------------------
create or replace function public.set_marketing_plans_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists marketing_plans_updated_at on public.marketing_plans;
create trigger marketing_plans_updated_at
  before update on public.marketing_plans
  for each row execute procedure public.set_marketing_plans_updated_at();

drop trigger if exists marketing_plan_items_updated_at on public.marketing_plan_items;
create trigger marketing_plan_items_updated_at
  before update on public.marketing_plan_items
  for each row execute procedure public.set_marketing_plans_updated_at();

-- indexes
create index if not exists marketing_plans_status_idx        on public.marketing_plans (status);
create index if not exists marketing_plans_created_by_idx     on public.marketing_plans (created_by);
create index if not exists marketing_plan_items_plan_id_idx   on public.marketing_plan_items (plan_id);
create index if not exists marketing_plan_items_task_id_idx   on public.marketing_plan_items (task_id);
create index if not exists marketing_plan_items_status_idx    on public.marketing_plan_items (status);

-- ----------------------------------------------------------
-- RLS — staff-only. Service-role (used by the API after a
-- requireRole(["admin"]) check) bypasses RLS; these policies
-- cover any direct authenticated access.
-- ----------------------------------------------------------
alter table public.marketing_plans      enable row level security;
alter table public.marketing_plan_items enable row level security;

drop policy if exists "marketing_plans_admin_all" on public.marketing_plans;
create policy "marketing_plans_admin_all"
  on public.marketing_plans for all to authenticated
  using (is_admin()) with check (is_admin());

drop policy if exists "marketing_plan_items_admin_all" on public.marketing_plan_items;
create policy "marketing_plan_items_admin_all"
  on public.marketing_plan_items for all to authenticated
  using (is_admin()) with check (is_admin());

-- ----------------------------------------------------------
-- Extend tasks.context_type so an initiative-task links back
-- to its plan via context_type='marketing_plan', context_id=plan_id.
-- ----------------------------------------------------------
alter table public.tasks drop constraint if exists tasks_context_type_check;
alter table public.tasks add constraint tasks_context_type_check
  check (context_type in ('personal', 'company', 'deal', 'internal', 'marketing_plan'));
