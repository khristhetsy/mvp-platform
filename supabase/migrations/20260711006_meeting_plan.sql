-- Weekly Meeting System — Step 6: Plan of Action.
-- The strategic layer above weekly KPIs (numeric) and tasks (short-term): departmental
-- (or company-level, department_id null) OBJECTIVES, each broken into MILESTONES with a
-- simple done/not-done checklist. Objective progress = milestones done / total. Reviewed
-- in the weekly meeting. Objectives are archived (archived_at), never hard-deleted.

create table if not exists public.ceo_plan_objectives (
  id            uuid primary key default gen_random_uuid(),
  department_id uuid references public.departments(id) on delete set null,
  title         text not null,
  description   text,
  period_label  text,                         -- e.g. "Q3 2026"
  target_date   date,
  status        text not null default 'on_track'
                  check (status in ('on_track','at_risk','off_track','done')),
  position      int not null default 0,
  archived_at   timestamptz,
  created_by    uuid references public.profiles(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists ceo_plan_objectives_dept_idx
  on public.ceo_plan_objectives (department_id, position)
  where archived_at is null;

create table if not exists public.ceo_plan_milestones (
  id            uuid primary key default gen_random_uuid(),
  objective_id  uuid not null references public.ceo_plan_objectives(id) on delete cascade,
  title         text not null,
  owner_id      uuid references public.profiles(id),
  due_date      date,
  done          boolean not null default false,
  done_at       timestamptz,
  position      int not null default 0,
  created_at    timestamptz not null default now()
);

create index if not exists ceo_plan_milestones_obj_idx
  on public.ceo_plan_milestones (objective_id, position);

alter table public.ceo_plan_objectives enable row level security;
alter table public.ceo_plan_milestones enable row level security;

drop policy if exists ceo_plan_objectives_staff on public.ceo_plan_objectives;
create policy ceo_plan_objectives_staff on public.ceo_plan_objectives
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists ceo_plan_milestones_staff on public.ceo_plan_milestones;
create policy ceo_plan_milestones_staff on public.ceo_plan_milestones
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

grant select, insert, update, delete on public.ceo_plan_objectives to service_role;
grant select, insert, update, delete on public.ceo_plan_milestones to service_role;
