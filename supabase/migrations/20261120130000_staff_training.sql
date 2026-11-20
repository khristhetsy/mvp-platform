-- Staff Training: an invitation only course in Learning, with AI coach options.
-- Four tables. Nobody can open the course unless they hold an enrollment, and an enrollment is
-- created only by accepting an invitation sent by staff. The AI coach is a per enrollment switch.
-- The existing coach_* tables (founder and company based) are not touched.
-- Idempotent. Rollback: drop the four tables below (policies drop with them).
--
-- Who can see what (RLS):
--   staff_training_invites      staff: read and write all. The invitee never reads this table:
--                               acceptance runs on the server (service role) with the token.
--   staff_training_enrollments  trainee: read own row. staff: read and write all. Coach switch changes go through the server.
--   staff_training_progress     trainee: own rows only. staff: read all.
--   staff_training_exercises    trainee: own rows (insert and read). staff: read all and mark Pass or Redo.

-- 1. Invitations. Only a hash of the token is stored, so a leaked table cannot be used to accept.
create table if not exists public.staff_training_invites (
  id uuid primary key default gen_random_uuid(),
  email text not null check (position('@' in email) > 1),
  audience text not null default 'staff' check (audience in ('staff', 'licensee')),
  organization_label text not null default 'iCFO Capital Global',
  reviewer_label text not null default 'Senior Tech Support',
  coach_enabled boolean not null default true,
  token_hash text not null unique,
  status text not null default 'invited' check (status in ('invited', 'accepted', 'revoked')),
  invited_by uuid references public.profiles(id) on delete set null,
  accepted_by uuid references public.profiles(id) on delete set null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists staff_training_invites_email_idx
  on public.staff_training_invites (lower(email), created_at desc);

alter table public.staff_training_invites enable row level security;

drop policy if exists staff_training_invites_staff on public.staff_training_invites;
create policy staff_training_invites_staff on public.staff_training_invites
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- 2. Enrollment: one row per trainee. This row is the access list.
create table if not exists public.staff_training_enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  invite_id uuid references public.staff_training_invites(id) on delete set null,
  audience text not null default 'staff' check (audience in ('staff', 'licensee')),
  organization_label text not null default 'iCFO Capital Global',
  reviewer_label text not null default 'Senior Tech Support',
  coach_on boolean not null default true,
  coach_tone text not null default 'driven' check (coach_tone in ('encouraging', 'driven', 'relentless')),
  status text not null default 'active' check (status in ('active', 'completed', 'removed')),
  started_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists staff_training_enrollments_touch on public.staff_training_enrollments;
create trigger staff_training_enrollments_touch
  before update on public.staff_training_enrollments
  for each row execute function public.touch_updated_at();

alter table public.staff_training_enrollments enable row level security;

drop policy if exists staff_training_enrollments_select on public.staff_training_enrollments;
create policy staff_training_enrollments_select on public.staff_training_enrollments
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_staff());

-- Trainees do not update their own row in the database. The coach switch and style are changed
-- through the server (service role) after it checks the caller, so a trainee cannot edit access
-- fields such as audience, organization, reviewer or status.
drop policy if exists staff_training_enrollments_update on public.staff_training_enrollments;
create policy staff_training_enrollments_update on public.staff_training_enrollments
  for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists staff_training_enrollments_staff_write on public.staff_training_enrollments;
create policy staff_training_enrollments_staff_write on public.staff_training_enrollments
  for insert to authenticated
  with check (public.is_staff());

drop policy if exists staff_training_enrollments_staff_delete on public.staff_training_enrollments;
create policy staff_training_enrollments_staff_delete on public.staff_training_enrollments
  for delete to authenticated
  using (public.is_staff());

-- 3. Progress: one row per trainee, module and step.
create table if not exists public.staff_training_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  module_key text not null check (char_length(module_key) between 1 and 80),
  step_index integer not null check (step_index >= 0),
  done boolean not null default true,
  updated_at timestamptz not null default now(),
  unique (user_id, module_key, step_index)
);

alter table public.staff_training_progress enable row level security;

drop policy if exists staff_training_progress_own on public.staff_training_progress;
create policy staff_training_progress_own on public.staff_training_progress
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists staff_training_progress_staff_read on public.staff_training_progress;
create policy staff_training_progress_staff_read on public.staff_training_progress
  for select to authenticated
  using (public.is_staff());

-- 4. Exercises: the trainee's answer, the AI first pass, and the reviewer's Pass or Redo.
create table if not exists public.staff_training_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  module_key text not null check (char_length(module_key) between 1 and 80),
  exercise_index integer not null check (exercise_index >= 0),
  answer text not null check (char_length(btrim(answer)) between 1 and 8000),
  ai_feedback text,
  status text not null default 'submitted' check (status in ('submitted', 'pass', 'redo')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists staff_training_exercises_user_idx
  on public.staff_training_exercises (user_id, module_key, exercise_index, created_at desc);
create index if not exists staff_training_exercises_open_idx
  on public.staff_training_exercises (created_at) where status = 'submitted';

alter table public.staff_training_exercises enable row level security;

drop policy if exists staff_training_exercises_own_read on public.staff_training_exercises;
create policy staff_training_exercises_own_read on public.staff_training_exercises
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_staff());

drop policy if exists staff_training_exercises_own_insert on public.staff_training_exercises;
create policy staff_training_exercises_own_insert on public.staff_training_exercises
  for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'submitted');

drop policy if exists staff_training_exercises_staff_update on public.staff_training_exercises;
create policy staff_training_exercises_staff_update on public.staff_training_exercises
  for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());
