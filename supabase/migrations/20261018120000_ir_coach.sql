-- AI IR Coach: enrollment, step events, commitments, message log, and a per-course switch.
-- The coach is OFF by default: nobody is enrolled and no course has the coach enabled until
-- an admin acts. The existing notifications, notification preferences, founder email budget,
-- founder_lesson_progress and founder_lesson_notes are reused and not changed by this file.
-- Idempotent. Rollback: drop the five tables below (policies drop with them).
--
-- Who can see what (RLS):
--   coach_enrollments      founder: own rows (read, opt in, pause, change style). staff: read all, write all.
--   coach_step_events      founder: own rows only. Staff reports read aggregates through the service role.
--   coach_commitments      founder: own rows only. Same note as above.
--   coach_messages         founder: read own. staff: read all. Written by the server only (service role).
--   course_coach_config    any signed in user can read (to know whether a course has the coach). staff: write.

-- 1. Enrollment: one row per founder and company.
create table if not exists public.coach_enrollments (
  id uuid primary key default gen_random_uuid(),
  founder_id uuid not null references public.profiles(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'paused', 'ended')),
  tone text not null default 'driven' check (tone in ('encouraging', 'driven', 'relentless')),
  source text not null default 'admin_selected' check (source in ('admin_all', 'admin_selected', 'founder_opt_in')),
  enrolled_by uuid references public.profiles(id) on delete set null,
  intake jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  paused_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (founder_id, company_id)
);

create index if not exists coach_enrollments_status_idx
  on public.coach_enrollments (status, started_at);

drop trigger if exists coach_enrollments_touch on public.coach_enrollments;
create trigger coach_enrollments_touch
  before update on public.coach_enrollments
  for each row execute function public.touch_updated_at();

alter table public.coach_enrollments enable row level security;

drop policy if exists coach_enrollments_select_own on public.coach_enrollments;
create policy coach_enrollments_select_own on public.coach_enrollments
  for select to authenticated
  using (founder_id = (select auth.uid()) or public.is_staff());

-- A founder may opt themselves in. Staff enroll others.
drop policy if exists coach_enrollments_insert on public.coach_enrollments;
create policy coach_enrollments_insert on public.coach_enrollments
  for insert to authenticated
  with check (
    public.is_staff()
    or (founder_id = (select auth.uid()) and source = 'founder_opt_in')
  );

drop policy if exists coach_enrollments_update on public.coach_enrollments;
create policy coach_enrollments_update on public.coach_enrollments
  for update to authenticated
  using (founder_id = (select auth.uid()) or public.is_staff())
  with check (founder_id = (select auth.uid()) or public.is_staff());

drop policy if exists coach_enrollments_delete_staff on public.coach_enrollments;
create policy coach_enrollments_delete_staff on public.coach_enrollments
  for delete to authenticated
  using (public.is_staff());

-- 2. Step events: I did it, I am stuck, Not now. The optional note is the founder's own words.
create table if not exists public.coach_step_events (
  id uuid primary key default gen_random_uuid(),
  founder_id uuid not null references public.profiles(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  course_slug text not null,
  lesson_id text not null,
  step_index integer not null check (step_index >= 0),
  event text not null check (event in ('done', 'stuck', 'skipped')),
  note text check (note is null or char_length(note) <= 2000),
  created_at timestamptz not null default now()
);

create index if not exists coach_step_events_founder_idx
  on public.coach_step_events (founder_id, company_id, course_slug, created_at desc);

alter table public.coach_step_events enable row level security;

drop policy if exists coach_step_events_own on public.coach_step_events;
create policy coach_step_events_own on public.coach_step_events
  for all to authenticated
  using (founder_id = (select auth.uid()))
  with check (founder_id = (select auth.uid()));

-- 3. Commitments: a time the founder chose for a step they put off. A Task or Calendar item is
-- created only after the founder confirms, and its id is stored in task_ref.
create table if not exists public.coach_commitments (
  id uuid primary key default gen_random_uuid(),
  founder_id uuid not null references public.profiles(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  course_slug text not null,
  lesson_id text not null,
  step_index integer not null check (step_index >= 0),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  due_choice text not null check (due_choice in ('today', 'tomorrow', 'this_week')),
  due_at timestamptz not null,
  status text not null default 'open' check (status in ('open', 'kept', 'missed', 'cancelled')),
  task_ref text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists coach_commitments_open_idx
  on public.coach_commitments (due_at) where status = 'open';
create index if not exists coach_commitments_founder_idx
  on public.coach_commitments (founder_id, company_id, created_at desc);

alter table public.coach_commitments enable row level security;

drop policy if exists coach_commitments_own on public.coach_commitments;
create policy coach_commitments_own on public.coach_commitments
  for all to authenticated
  using (founder_id = (select auth.uid()))
  with check (founder_id = (select auth.uid()));

-- 4. Message log and queue. The server writes it with the service role. Every message the coach
-- sends or holds back is recorded here, so staff can review tone and results.
create table if not exists public.coach_messages (
  id uuid primary key default gen_random_uuid(),
  founder_id uuid not null references public.profiles(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  kind text not null check (kind in (
    'follow_up_due', 'weekly_wrap', 'meeting_prep', 'reply_alert',
    'commitment_check', 'quiet_founder', 'scorecard_check', 'intro'
  )),
  channel text not null check (channel in ('in_app', 'email')),
  tone text not null check (tone in ('encouraging', 'driven', 'relentless')),
  status text not null default 'queued' check (status in ('queued', 'sent', 'suppressed', 'failed')),
  suppressed_reason text,
  scheduled_at timestamptz not null default now(),
  sent_at timestamptz,
  opened_at timestamptz,
  notification_id uuid references public.notifications(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists coach_messages_due_idx
  on public.coach_messages (scheduled_at) where status = 'queued';
create index if not exists coach_messages_founder_idx
  on public.coach_messages (founder_id, created_at desc);

alter table public.coach_messages enable row level security;

drop policy if exists coach_messages_select on public.coach_messages;
create policy coach_messages_select on public.coach_messages
  for select to authenticated
  using (founder_id = (select auth.uid()) or public.is_staff());

-- 5. Per course switch. Off unless a row says otherwise. A course cannot be enabled until its
-- steps are in the coach format (steps_ready). course_key is the course slug, or the admin
-- course id for courses built in Admin, Learning, Courses.
create table if not exists public.course_coach_config (
  course_key text primary key,
  enabled boolean not null default false,
  steps_ready boolean not null default false,
  tone text check (tone is null or tone in ('encouraging', 'driven', 'relentless')),
  data_sources text[] not null default '{}',
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  check (not enabled or steps_ready)
);

drop trigger if exists course_coach_config_touch on public.course_coach_config;
create trigger course_coach_config_touch
  before update on public.course_coach_config
  for each row execute function public.touch_updated_at();

alter table public.course_coach_config enable row level security;

drop policy if exists course_coach_config_select on public.course_coach_config;
create policy course_coach_config_select on public.course_coach_config
  for select to authenticated
  using (true);

drop policy if exists course_coach_config_write_staff on public.course_coach_config;
create policy course_coach_config_write_staff on public.course_coach_config
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());
