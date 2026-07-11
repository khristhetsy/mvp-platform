-- Weekly Meeting System — Step 2 (Tasks & routing).
-- Meeting tasks with the IR sheet's dual-note model (agent_note + ceo_note) and AI
-- task suggestions. Namespaced ceo_meeting_* to sit with the extended meeting log.
-- ceo_note write-protection is enforced in the API layer (admin role only), since the
-- app writes via the service role (auth.uid() is null there, so a role trigger can't see it).

create table if not exists public.ceo_meeting_tasks (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  department_id  uuid references public.departments(id),
  assignee_id    uuid references public.profiles(id),
  priority       text not null default 'high' check (priority in ('urgent','high','med','low')),
  status         text not null default 'not_started' check (status in ('not_started','in_progress','done','cancelled')),
  start_date     date,
  due_date       date,
  session_id     uuid references public.ceo_meeting_sessions(id) on delete set null,
  source         text not null default 'manual' check (source in ('manual','ai_confirmed','plan','checklist','import')),
  linked_event_id uuid,
  agent_note     text,   -- editable by the owning department
  ceo_note       text,   -- editable ONLY by CEO/Admin (enforced in API)
  created_by     uuid references public.profiles(id),
  created_at     timestamptz not null default now(),
  completed_at   timestamptz
);
create index if not exists ceo_meeting_tasks_dept_idx on public.ceo_meeting_tasks (department_id);
create index if not exists ceo_meeting_tasks_assignee_idx on public.ceo_meeting_tasks (assignee_id);
create index if not exists ceo_meeting_tasks_session_idx on public.ceo_meeting_tasks (session_id);
create index if not exists ceo_meeting_tasks_status_idx on public.ceo_meeting_tasks (status);
alter table public.ceo_meeting_tasks enable row level security;
drop policy if exists ceo_meeting_tasks_staff on public.ceo_meeting_tasks;
create policy ceo_meeting_tasks_staff on public.ceo_meeting_tasks
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

create table if not exists public.ceo_meeting_task_suggestions (
  id                     uuid primary key default gen_random_uuid(),
  session_id             uuid references public.ceo_meeting_sessions(id) on delete cascade,
  section_id             uuid references public.ceo_meeting_sections(id) on delete set null,
  title                  text not null,
  suggested_department_id uuid references public.departments(id),
  suggested_assignee_id  uuid references public.profiles(id),
  suggested_due          date,
  rationale              text,
  status                 text not null default 'pending' check (status in ('pending','confirmed','dismissed')),
  confirmed_task_id      uuid references public.ceo_meeting_tasks(id) on delete set null,
  created_at             timestamptz not null default now()
);
create index if not exists ceo_meeting_task_suggestions_session_idx on public.ceo_meeting_task_suggestions (session_id, status);
alter table public.ceo_meeting_task_suggestions enable row level security;
drop policy if exists ceo_meeting_task_suggestions_staff on public.ceo_meeting_task_suggestions;
create policy ceo_meeting_task_suggestions_staff on public.ceo_meeting_task_suggestions
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
