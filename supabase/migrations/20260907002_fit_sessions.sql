-- /fit funnel sessions (build-spec §6, §8). One row per funnel arrival, written on
-- landing BEFORE any answer, so arrivals who never answer Q1 are still visible.
-- last_step is the primary drop-off diagnostic; match_snapshot is exactly what the
-- founder was shown. Incomplete sessions never become CRM contacts — they only tell
-- you where people quit.

create table if not exists public.fit_sessions (
  id             uuid primary key default gen_random_uuid(),
  source_tag     text,                       -- {channel}-{account|campaign}-{item}, or 'direct'
  last_step      integer not null default 0, -- 0 = landed, 1-4 = last answered question, 5 = saw matches
  stage          text,
  raise          text,
  industry       text,
  revenue        text,
  matched_count  integer,
  match_snapshot jsonb,                       -- the exact list displayed
  email          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists fit_sessions_source_idx on public.fit_sessions (source_tag);
create index if not exists fit_sessions_step_idx   on public.fit_sessions (last_step);
