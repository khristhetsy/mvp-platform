-- Readiness score impact per module completion.

alter table public.learning_modules
  add column if not exists score_points integer not null default 0 check (score_points >= 0);

update public.learning_modules
set score_points = 10
where score_points = 0 and is_published = true;
