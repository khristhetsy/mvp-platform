-- Investor Relations Hub · Deal flow (build spec v1.0, Sep 17 2026).
--
-- One founder raise = an IR project (`ir_projects`), 4–6 months long, cut into month
-- milestones (28 days) and week milestones (7 days). Investors are matched to a
-- project (`ir_matches`, one row per investor per project), inside a weekly batch
-- task (`ir_tasks`). Activities are one table: open (`done_at is null`) = to-do,
-- done = log entry. Stage history is written by trigger so a founder report can show
-- the pipeline as it stood on a past date.
--
-- Naming: `ir_` prefix (the spec's open decision #1). `deal_*` already belongs to the
-- deal-rooms feature and "Deal Company" is an SPV label in the UI, so `deals` would
-- read two ways. Investor identity stays in crm_contacts — no phone / email is ever
-- copied here.
--
-- Access: RLS on, staff (public.is_staff()) read/write everything. Founders never read
-- these tables directly; the founder report is served by a server route that selects
-- only founder-safe fields. Subscribers see nothing.

-- 1. Projects --------------------------------------------------------------
create table if not exists public.ir_projects (
  id                       uuid primary key default gen_random_uuid(),
  company_id               uuid references public.companies(id),            -- founder's platform company (portal report)
  founder_contact_id       uuid references public.crm_contacts(id),         -- founder as a CRM contact (Odoo-era founders)
  title                    text not null,                      -- 'Doyle Organics'
  founder_name             text,                               -- display only
  owner_id                 uuid not null references public.profiles(id),
  source_opportunity_id    uuid references public.sales_opportunities(id),  -- closed-won deal in Sales Hub
  start_date               date not null,
  term_months              smallint not null check (term_months between 4 and 6),
  end_date                 date generated always as (start_date + term_months * 28) stored,
  status                   text not null default 'active' check (status in ('active','paused','completed','cancelled')),
  founder_report_visible   boolean not null default true,
  is_spv                   boolean not null default false,
  starred                  boolean not null default false,
  odoo_project_ids         int[],                              -- import trace; drop after cutover
  created_by               uuid not null references public.profiles(id),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  check (company_id is not null or founder_contact_id is not null)
);
create index if not exists ir_projects_company_idx on public.ir_projects (company_id);
create index if not exists ir_projects_status_idx  on public.ir_projects (status);

-- 2. Milestones: months, and weeks inside months ---------------------------
create table if not exists public.ir_milestones (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.ir_projects(id) on delete cascade,
  parent_id     uuid references public.ir_milestones(id) on delete cascade,   -- week -> month
  kind          text not null check (kind in ('month','week')),
  label         text not null,                                                -- 'Month 1', 'Week 3'
  starts_on     date not null,
  ends_on       date not null check (ends_on > starts_on),
  sort_order    smallint not null,                                            -- 1-based within kind
  completed_at  timestamptz,
  unique (project_id, kind, sort_order)
);
create index if not exists ir_milestones_project_idx on public.ir_milestones (project_id, kind, sort_order);

-- 3. Weekly batch task -----------------------------------------------------
create table if not exists public.ir_tasks (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.ir_projects(id) on delete cascade,
  milestone_id  uuid not null references public.ir_milestones(id) on delete cascade,  -- a week milestone
  title         text not null,                                                        -- 'Michael Doyle Week 22'
  status        text not null default 'new' check (status in ('new','in_progress','done')),
  assignee_id   uuid references public.profiles(id),
  starred       boolean not null default false,
  notes         text,
  deadline      date,
  odoo_task_id  int,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists ir_tasks_project_idx   on public.ir_tasks (project_id);
create index if not exists ir_tasks_milestone_idx on public.ir_tasks (milestone_id);

-- 4. One investor matched to one project ----------------------------------
create table if not exists public.ir_matches (
  id                      uuid primary key default gen_random_uuid(),
  project_id              uuid not null references public.ir_projects(id) on delete cascade,
  investor_contact_id     uuid not null references public.crm_contacts(id),
  task_id                 uuid references public.ir_tasks(id) on delete set null,      -- week it was matched in
  milestone_id            uuid references public.ir_milestones(id) on delete set null, -- month
  stage                   text not null default 'matched'
    check (stage in ('matched','intro_sent','contacted','meeting_scheduled','meeting_held','follow_up','committed','passed')),
  assignee_id             uuid references public.profiles(id),
  fit_tier                text check (fit_tier in ('high','medium','low')),
  data_source             text,                                                        -- 'verified' | 'self_reported' | null
  founder_visible         boolean not null default true,
  starred                 boolean not null default false,
  stage_changed_at        timestamptz not null default now(),
  term_sheet_received_at  timestamptz,
  meeting_booking_id      uuid references public.scheduling_bookings(id) on delete set null,
  odoo_tag                text,
  created_by              uuid references public.profiles(id),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (project_id, investor_contact_id)
);
create index if not exists ir_matches_project_stage_idx on public.ir_matches (project_id, stage);
create index if not exists ir_matches_investor_idx      on public.ir_matches (investor_contact_id);
create index if not exists ir_matches_task_idx          on public.ir_matches (task_id);

-- 5. Stage history (trigger-written) --------------------------------------
create table if not exists public.ir_match_stage_events (
  id          bigserial primary key,
  match_id    uuid not null references public.ir_matches(id) on delete cascade,
  from_stage  text,
  to_stage    text not null,
  changed_by  uuid references public.profiles(id),
  changed_at  timestamptz not null default now()
);
create index if not exists ir_match_stage_events_match_idx on public.ir_match_stage_events (match_id, changed_at);

-- Who changed it: routes set `set_config('ir.actor', <profile id>, true)` per request;
-- absent that, the event is recorded with changed_by null.
create or replace function public.ir_match_stage_event()
returns trigger language plpgsql as $$
declare actor uuid;
begin
  begin actor := nullif(current_setting('ir.actor', true), '')::uuid; exception when others then actor := null; end;
  if tg_op = 'INSERT' then
    insert into public.ir_match_stage_events (match_id, from_stage, to_stage, changed_by)
      values (new.id, null, new.stage, coalesce(actor, new.created_by));
  elsif new.stage is distinct from old.stage then
    new.stage_changed_at := now();
    insert into public.ir_match_stage_events (match_id, from_stage, to_stage, changed_by)
      values (new.id, old.stage, new.stage, actor);
  end if;
  return new;
end $$;

drop trigger if exists ir_match_stage_event_ins on public.ir_matches;
create trigger ir_match_stage_event_ins after insert on public.ir_matches
  for each row execute function public.ir_match_stage_event();
drop trigger if exists ir_match_stage_event_upd on public.ir_matches;
create trigger ir_match_stage_event_upd before update of stage on public.ir_matches
  for each row execute function public.ir_match_stage_event();

-- 6. Activities: to-dos when open, log entries when done -------------------
create table if not exists public.ir_activities (
  id                 uuid primary key default gen_random_uuid(),
  project_id         uuid not null references public.ir_projects(id) on delete cascade,
  match_id           uuid references public.ir_matches(id) on delete cascade,
  task_id            uuid references public.ir_tasks(id) on delete cascade,       -- week-level activity
  type               text not null check (type in ('email','call','voicemail','meeting','document','term_sheet','note')),
  subject            text not null,                                               -- 'Second call attempt'
  description        text,                                                        -- founder-readable: what happened
  outcome            text,                                                        -- 'No answer, voicemail left'
  next_step          text,
  due_at             timestamptz,
  done_at            timestamptz,
  calendar_event_id  text,
  founder_visible    boolean not null default true,
  assignee_id        uuid references public.profiles(id),
  created_by         uuid not null references public.profiles(id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  check (match_id is not null or task_id is not null)
);
create index if not exists ir_activities_match_idx   on public.ir_activities (match_id, done_at);
create index if not exists ir_activities_task_idx    on public.ir_activities (task_id, done_at);
create index if not exists ir_activities_project_idx on public.ir_activities (project_id, done_at);
create index if not exists ir_activities_open_due_idx on public.ir_activities (due_at) where done_at is null;

-- 7. IR team notes (founder report when founder_visible) -------------------
create table if not exists public.ir_notes (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null references public.ir_projects(id) on delete cascade,
  match_id         uuid references public.ir_matches(id) on delete set null,
  body             text not null,
  founder_visible  boolean not null default false,
  noted_on         date not null default current_date,
  created_by       uuid not null references public.profiles(id),
  created_at       timestamptz not null default now()
);
create index if not exists ir_notes_project_idx on public.ir_notes (project_id, noted_on);

-- 8. Goals for the dashboard -----------------------------------------------
create table if not exists public.ir_goals (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid references public.ir_projects(id) on delete cascade,   -- null = firm-wide
  assignee_id    uuid references public.profiles(id),                        -- optional per-agent
  metric         text not null check (metric in ('meetings_held','term_sheets','calls','emails','intros')),
  period_kind    text not null check (period_kind in ('week','month')),
  period_start   date not null,
  period_end     date not null,
  target         numeric not null check (target >= 0),
  created_by     uuid references public.profiles(id),
  created_at     timestamptz not null default now()
);
create unique index if not exists ir_goals_unique_idx
  on public.ir_goals (coalesce(project_id, '00000000-0000-0000-0000-000000000000'::uuid),
                      coalesce(assignee_id, '00000000-0000-0000-0000-000000000000'::uuid),
                      metric, period_kind, period_start);

-- 9. Founder reports --------------------------------------------------------
create table if not exists public.ir_reports (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references public.ir_projects(id) on delete cascade,
  period_kind    text not null check (period_kind in ('week','month','custom')),
  period_start   date not null,
  period_end     date not null,
  exec_summary   jsonb not null default '{}'::jsonb,   -- {bottom, lead, highlights[], themes[], watch[], asks[]}
  metrics        jsonb not null default '{}'::jsonb,   -- frozen at generation time
  approved_by    uuid references public.profiles(id),
  approved_at    timestamptz,
  sent_to        text,
  sent_at        timestamptz,
  pdf_path       text,
  created_by     uuid not null references public.profiles(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists ir_reports_project_idx on public.ir_reports (project_id, period_start);

-- 10. RLS: staff everything; founders/subscribers nothing (server routes filter) ----
do $$
declare t text;
begin
  foreach t in array array['ir_projects','ir_milestones','ir_tasks','ir_matches','ir_match_stage_events','ir_activities','ir_notes','ir_goals','ir_reports'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_staff_all', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.is_staff()) with check (public.is_staff())', t || '_staff_all', t);
  end loop;
end $$;
