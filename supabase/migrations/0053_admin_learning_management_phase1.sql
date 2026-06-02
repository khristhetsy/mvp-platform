-- Phase 1: Admin Learning Management layer (courses/programs, modules, lessons, quizzes, approvals, certificates).
-- Additive only: preserves existing founder learning flows and tables.

-- Content status enum (safe text + check constraint to avoid extension dependencies).
do $$
begin
  -- learning_modules: add workflow status while keeping is_published for founder gating.
  alter table public.learning_modules
    add column if not exists content_status text not null default 'published'
      check (content_status in ('draft','pending_review','approved','published','archived')),
    add column if not exists updated_at timestamptz not null default now();

  -- learning_programs: add workflow status while keeping is_published for founder gating.
  alter table public.learning_programs
    add column if not exists content_status text not null default 'published'
      check (content_status in ('draft','pending_review','approved','published','archived')),
    add column if not exists category text,
    add column if not exists difficulty text default 'intermediate',
    add column if not exists updated_at timestamptz not null default now();
exception
  when undefined_table then
    -- If learning tables aren't present in this environment yet, migration order is wrong.
    raise;
end $$;

-- Admin-editable lesson content (optional for founder rendering; Phase 1 admin ops only).
create table if not exists public.learning_lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid references public.learning_modules(id) on delete cascade,
  module_slug text not null,
  lesson_key text not null,
  title text not null,
  body_markdown text not null default '',
  order_index integer not null default 0,
  estimated_time_minutes integer not null default 10,
  content_status text not null default 'draft'
    check (content_status in ('draft','pending_review','approved','published','archived')),
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (module_slug, lesson_key)
);

-- Quiz definitions (attempts already exist as founder_quiz_attempts).
create table if not exists public.learning_quizzes (
  id uuid primary key default gen_random_uuid(),
  scope_type text not null default 'lesson'
    check (scope_type in ('course','module','lesson')),
  program_id uuid references public.learning_programs(id) on delete cascade,
  module_id uuid references public.learning_modules(id) on delete cascade,
  lesson_id uuid references public.learning_lessons(id) on delete cascade,
  title text not null,
  passing_score integer not null default 70 check (passing_score >= 0 and passing_score <= 100),
  retry_limit integer,
  content_status text not null default 'draft'
    check (content_status in ('draft','pending_review','approved','published','archived')),
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.learning_quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.learning_quizzes(id) on delete cascade,
  order_index integer not null default 0,
  prompt text not null,
  options jsonb not null default '[]'::jsonb,
  correct_option_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists learning_lessons_module_idx on public.learning_lessons (module_id, order_index);
create index if not exists learning_quizzes_scope_idx on public.learning_quizzes (scope_type, created_at desc);
create index if not exists learning_quiz_questions_quiz_idx on public.learning_quiz_questions (quiz_id, order_index);

-- Certificates of completion (admin-issued, no regulatory claims).
create table if not exists public.learning_certificates (
  id uuid primary key default gen_random_uuid(),
  founder_id uuid not null references public.profiles(id) on delete cascade,
  company_id uuid references public.companies(id) on delete set null,
  program_id uuid references public.learning_programs(id) on delete set null,
  certificate_title text not null,
  certificate_code text not null unique,
  status text not null default 'issued'
    check (status in ('issued','revoked','archived')),
  issued_at timestamptz not null default now(),
  issued_by uuid references public.profiles(id),
  metadata jsonb,
  created_at timestamptz not null default now()
);

-- Approval workflow audit trail.
create table if not exists public.learning_content_approvals (
  id uuid primary key default gen_random_uuid(),
  content_type text not null check (content_type in ('program','module','lesson','quiz')),
  content_id uuid not null,
  from_status text not null,
  to_status text not null,
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  notes text,
  created_at timestamptz not null default now()
);

-- RLS
alter table public.learning_lessons enable row level security;
alter table public.learning_quizzes enable row level security;
alter table public.learning_quiz_questions enable row level security;
alter table public.learning_certificates enable row level security;
alter table public.learning_content_approvals enable row level security;

-- Published content readable by authenticated; staff can read all.
drop policy if exists "learning_lessons_select_published" on public.learning_lessons;
create policy "learning_lessons_select_published"
  on public.learning_lessons for select to authenticated
  using (content_status = 'published' or public.is_staff());

drop policy if exists "learning_quizzes_select_published" on public.learning_quizzes;
create policy "learning_quizzes_select_published"
  on public.learning_quizzes for select to authenticated
  using (content_status = 'published' or public.is_staff());

drop policy if exists "learning_quiz_questions_select_published" on public.learning_quiz_questions;
create policy "learning_quiz_questions_select_published"
  on public.learning_quiz_questions for select to authenticated
  using (
    public.is_staff()
    or exists (select 1 from public.learning_quizzes q where q.id = quiz_id and q.content_status = 'published')
  );

-- Staff-only writes for content tables
drop policy if exists "learning_lessons_write_staff" on public.learning_lessons;
create policy "learning_lessons_write_staff"
  on public.learning_lessons for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists "learning_quizzes_write_staff" on public.learning_quizzes;
create policy "learning_quizzes_write_staff"
  on public.learning_quizzes for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists "learning_quiz_questions_write_staff" on public.learning_quiz_questions;
create policy "learning_quiz_questions_write_staff"
  on public.learning_quiz_questions for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- Certificates: staff can read/write; founders cannot read admin certificates yet (Phase 1 admin-only).
drop policy if exists "learning_certificates_select_staff" on public.learning_certificates;
create policy "learning_certificates_select_staff"
  on public.learning_certificates for select to authenticated
  using (public.is_staff());

drop policy if exists "learning_certificates_write_staff" on public.learning_certificates;
create policy "learning_certificates_write_staff"
  on public.learning_certificates for insert to authenticated
  with check (public.is_staff());

drop policy if exists "learning_certificates_update_staff" on public.learning_certificates;
create policy "learning_certificates_update_staff"
  on public.learning_certificates for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- Approvals trail: staff only
drop policy if exists "learning_content_approvals_select_staff" on public.learning_content_approvals;
create policy "learning_content_approvals_select_staff"
  on public.learning_content_approvals for select to authenticated
  using (public.is_staff());

drop policy if exists "learning_content_approvals_insert_staff" on public.learning_content_approvals;
create policy "learning_content_approvals_insert_staff"
  on public.learning_content_approvals for insert to authenticated
  with check (public.is_staff());

