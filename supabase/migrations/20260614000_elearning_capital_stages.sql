-- ============================================================
-- E-Learning: Capital Stage System
-- Tables: learning_course_schedules, admin_learning_stage_overrides,
--         admin_lesson_assignments, learning_deliverable_submissions
-- ============================================================

-- Founder weekly study schedule preferences
create table if not exists learning_course_schedules (
  id               uuid primary key default gen_random_uuid(),
  founder_id       uuid not null references profiles(id) on delete cascade,
  company_id       uuid not null references companies(id) on delete cascade,
  days_per_week    int not null default 3,
  preferred_time   text not null default '08:00',  -- e.g. "08:00"
  session_minutes  int not null default 25,
  study_days       text[] not null default array['monday','wednesday','thursday'],
  reminders_on     boolean not null default true,
  weekly_digest    boolean not null default true,
  inactivity_nudge boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (founder_id, company_id)
);

-- Admin overrides: unlock a capital stage for a specific founder bypassing the 80% threshold
create table if not exists admin_learning_stage_overrides (
  id              uuid primary key default gen_random_uuid(),
  founder_id      uuid not null references profiles(id) on delete cascade,
  company_id      uuid not null references companies(id) on delete cascade,
  capital_stage   text not null,  -- 'stage_0' | 'stage_1' | 'stage_2' | 'stage_3'
  is_unlocked     boolean not null default false,
  overridden_by   text not null,  -- admin display name
  overridden_at   timestamptz not null default now(),
  notes           text,
  created_at      timestamptz not null default now(),
  unique (founder_id, company_id, capital_stage)
);

-- Admin assigns specific lessons to a founder (overrides/supplements AI plan)
create table if not exists admin_lesson_assignments (
  id            uuid primary key default gen_random_uuid(),
  founder_id    uuid not null references profiles(id) on delete cascade,
  company_id    uuid not null references companies(id) on delete cascade,
  module_slug   text not null,
  lesson_id     text not null,
  lesson_title  text not null,
  assigned_by   text not null,  -- admin display name
  assigned_at   timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  unique (founder_id, company_id, module_slug, lesson_id)
);

-- Deliverable submissions — founder uploads/writes stage deliverable for AI scoring
create table if not exists learning_deliverable_submissions (
  id             uuid primary key default gen_random_uuid(),
  founder_id     uuid not null references profiles(id) on delete cascade,
  company_id     uuid not null references companies(id) on delete cascade,
  capital_stage  text not null,  -- which stage this deliverable is for
  deliverable_id text not null,  -- e.g. 'executive-summary', 'pitch-deck'
  content_text   text,           -- written answer or description
  file_url       text,           -- optional uploaded file
  ai_score       int,            -- 0-100 AI score
  ai_feedback    text,           -- AI feedback text
  submitted_at   timestamptz not null default now(),
  scored_at      timestamptz,
  created_at     timestamptz not null default now(),
  unique (founder_id, company_id, capital_stage, deliverable_id)
);

-- RLS policies
alter table learning_course_schedules enable row level security;
alter table admin_learning_stage_overrides enable row level security;
alter table admin_lesson_assignments enable row level security;
alter table learning_deliverable_submissions enable row level security;

-- learning_course_schedules: founder reads/writes own rows; admin reads all
drop policy if exists "founders_own_schedule" on learning_course_schedules;
create policy "founders_own_schedule" on learning_course_schedules
  for all using (founder_id = auth.uid());

drop policy if exists "admin_all_schedules" on learning_course_schedules;
create policy "admin_all_schedules" on learning_course_schedules
  for select using (
    exists (select 1 from profiles where id = auth.uid() and role in ('ADMIN', 'ANALYST'))
  );

-- admin_learning_stage_overrides: admin manages; founders read own
drop policy if exists "admin_manage_overrides" on admin_learning_stage_overrides;
create policy "admin_manage_overrides" on admin_learning_stage_overrides
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role in ('ADMIN', 'ANALYST'))
  );

drop policy if exists "founders_read_own_overrides" on admin_learning_stage_overrides;
create policy "founders_read_own_overrides" on admin_learning_stage_overrides
  for select using (founder_id = auth.uid());

-- admin_lesson_assignments: admin manages; founders read own
drop policy if exists "admin_manage_assignments" on admin_lesson_assignments;
create policy "admin_manage_assignments" on admin_lesson_assignments
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role in ('ADMIN', 'ANALYST'))
  );

drop policy if exists "founders_read_own_assignments" on admin_lesson_assignments;
create policy "founders_read_own_assignments" on admin_lesson_assignments
  for select using (founder_id = auth.uid());

-- learning_deliverable_submissions: founder owns; admin reads all
drop policy if exists "founders_own_deliverables" on learning_deliverable_submissions;
create policy "founders_own_deliverables" on learning_deliverable_submissions
  for all using (founder_id = auth.uid());

drop policy if exists "admin_read_deliverables" on learning_deliverable_submissions;
create policy "admin_read_deliverables" on learning_deliverable_submissions
  for select using (
    exists (select 1 from profiles where id = auth.uid() and role in ('ADMIN', 'ANALYST'))
  );
