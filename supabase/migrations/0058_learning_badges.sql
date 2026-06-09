-- Learning badges: catalog definitions and per-founder awards.

create table if not exists public.learning_badges (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null,
  icon_name text not null,
  criteria_type text not null check (
    criteria_type in ('modules_completed', 'lessons_completed', 'quiz_passed', 'streak_days')
  ),
  criteria_value integer not null check (criteria_value > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.learning_user_badges (
  id uuid primary key default gen_random_uuid(),
  founder_id uuid not null references public.profiles(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  badge_id uuid not null references public.learning_badges(id) on delete cascade,
  earned_at timestamptz not null default now(),
  unique (founder_id, company_id, badge_id)
);

create index if not exists learning_user_badges_founder_idx on public.learning_user_badges (founder_id);
create index if not exists learning_user_badges_company_idx on public.learning_user_badges (company_id);

alter table public.learning_badges enable row level security;
alter table public.learning_user_badges enable row level security;

drop policy if exists "learning_badges_select_authenticated" on public.learning_badges;
create policy "learning_badges_select_authenticated"
  on public.learning_badges for select to authenticated
  using (true);

drop policy if exists "learning_user_badges_select_own" on public.learning_user_badges;
create policy "learning_user_badges_select_own"
  on public.learning_user_badges for select to authenticated
  using (founder_id = auth.uid());

drop policy if exists "learning_user_badges_select_staff" on public.learning_user_badges;
create policy "learning_user_badges_select_staff"
  on public.learning_user_badges for select to authenticated
  using (public.is_staff());

insert into public.learning_badges (name, description, icon_name, criteria_type, criteria_value)
select v.name, v.description, v.icon_name, v.criteria_type, v.criteria_value
from (
  values
    ('First module', 'Complete your first learning module.', 'module-one', 'modules_completed', 1),
    ('Module trio', 'Complete three learning modules.', 'module-three', 'modules_completed', 3),
    ('Lesson starter', 'Complete five lessons.', 'lesson-five', 'lessons_completed', 5),
    ('Quiz ace', 'Pass your first lesson quiz.', 'quiz-star', 'quiz_passed', 1),
    ('Learning streak', 'Learn on seven consecutive days.', 'streak-seven', 'streak_days', 7)
) as v(name, description, icon_name, criteria_type, criteria_value)
where not exists (
  select 1 from public.learning_badges existing where existing.icon_name = v.icon_name
);
