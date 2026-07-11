-- Weekly Meeting System — Step 5: AI layer.
-- Cache table for AI meeting-prep briefs (narrative + focus points + risks), keyed by
-- an input hash so identical inputs reuse the last generation. Task suggestions already
-- live in ceo_meeting_task_suggestions (migration 20260711002); nothing to add there.
-- AI never writes business rows directly: suggestions are pending until a human confirms.

create table if not exists public.ceo_meeting_ai_briefs (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references public.ceo_meeting_sessions(id) on delete cascade,
  input_hash    text not null,
  model         text,
  narrative     text not null,
  focus_points  jsonb not null default '[]',
  risks         jsonb not null default '[]',
  generated_at  timestamptz not null default now(),
  created_by    uuid references public.profiles(id)
);

create index if not exists ceo_meeting_ai_briefs_lookup_idx
  on public.ceo_meeting_ai_briefs (session_id, generated_at desc);

alter table public.ceo_meeting_ai_briefs enable row level security;

drop policy if exists ceo_meeting_ai_briefs_staff on public.ceo_meeting_ai_briefs;
create policy ceo_meeting_ai_briefs_staff on public.ceo_meeting_ai_briefs
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

grant select, insert, update, delete on public.ceo_meeting_ai_briefs to service_role;
