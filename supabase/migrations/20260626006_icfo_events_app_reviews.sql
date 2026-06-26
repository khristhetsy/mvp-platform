-- Migration: 20260626006_icfo_events_app_reviews.sql
-- iCFO Events — Phase 3: multi-reviewer approval. Each staff reviewer records
-- their own rubric scores + recommendation for a speaker application; the final
-- approve/decline (on speaker_applications) is informed by the panel.

do $$ begin create type review_recommendation as enum ('approve','decline','abstain'); exception when duplicate_object then null; end $$;

create table if not exists public.speaker_application_reviews (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.speaker_applications(id) on delete cascade,
  reviewer_id    uuid not null references public.profiles(id) on delete cascade,
  rubric_scores  jsonb not null default '{}'::jsonb,
  recommendation review_recommendation not null default 'abstain',
  note           text check (char_length(note) <= 2000),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (application_id, reviewer_id)
);
create index if not exists app_reviews_application_idx on public.speaker_application_reviews(application_id);

drop trigger if exists app_reviews_touch on public.speaker_application_reviews;
create trigger app_reviews_touch before update on public.speaker_application_reviews
  for each row execute function public.touch_updated_at();

alter table public.speaker_application_reviews enable row level security;

-- staff only (the review panel is internal)
drop policy if exists app_reviews_staff_all on public.speaker_application_reviews;
create policy app_reviews_staff_all on public.speaker_application_reviews
  for all using (public.is_staff()) with check (public.is_staff());
