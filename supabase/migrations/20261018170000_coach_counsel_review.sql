-- AI IR Coach, Step 8: counsel review gate.
-- Counsel reviews every word the coach says to founders. The reviewed wording is recorded by its
-- fingerprint (SHA-256, computed on the server). A coach format course can only be switched on while
-- its current fingerprint matches the last review, so any later wording change turns it off until
-- counsel reviews again.
--
-- Access: course_coach_config keeps its existing policies. Only the fingerprint is stored there.
-- The review record itself (who reviewed, their reference, the date) is staff only and append only.

alter table public.course_coach_config
  add column if not exists reviewed_hash text;

create table if not exists public.coach_counsel_reviews (
  id uuid primary key default gen_random_uuid(),
  course_key text not null,
  content_hash text not null,
  reviewer_name text not null check (char_length(btrim(reviewer_name)) between 1 and 200),
  reference text check (reference is null or char_length(reference) <= 300),
  reviewed_on date not null,
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists coach_counsel_reviews_course_idx
  on public.coach_counsel_reviews (course_key, created_at desc);

alter table public.coach_counsel_reviews enable row level security;

-- Staff read the trail and add to it. There is no update or delete policy, so it cannot be rewritten.
drop policy if exists coach_counsel_reviews_select_staff on public.coach_counsel_reviews;
create policy coach_counsel_reviews_select_staff on public.coach_counsel_reviews
  for select to authenticated
  using (public.is_staff());

drop policy if exists coach_counsel_reviews_insert_staff on public.coach_counsel_reviews;
create policy coach_counsel_reviews_insert_staff on public.coach_counsel_reviews
  for insert to authenticated
  with check (public.is_staff() and recorded_by = (select auth.uid()));
