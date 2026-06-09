create table if not exists public.founder_quiz_reviews (
  id uuid primary key default gen_random_uuid(),
  founder_id uuid not null references public.profiles(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  module_slug text not null,
  lesson_id text not null,
  question_id text not null,
  next_review_at timestamptz not null default now(),
  interval_days integer not null default 1,
  ease_factor numeric not null default 2.5,
  last_score integer,
  review_count integer not null default 0,
  unique (founder_id, company_id, module_slug, lesson_id, question_id)
);

create index if not exists founder_quiz_reviews_due_idx
  on public.founder_quiz_reviews (founder_id, company_id, next_review_at);

alter table public.founder_quiz_reviews enable row level security;

drop policy if exists "founders_own_reviews" on public.founder_quiz_reviews;
create policy "founders_own_reviews"
  on public.founder_quiz_reviews for all to authenticated
  using (founder_id = auth.uid())
  with check (founder_id = auth.uid());
