-- IR auto sequences: a timed series of emails to one investor on one project (Share
-- Project record), sent by /api/cron/ir-sequences. Opens and clicks come back through the
-- Resend webhook (tagged with the enrollment id); replies are marked by staff; a meeting
-- stage stops the sequence. Every event alerts the account manager.
-- Staff read and write through the admin API with the service role, so RLS is on with no
-- policies: nothing is reachable with a user's own key.

create table if not exists public.ir_sequence_enrollments (
  id                uuid primary key default gen_random_uuid(),
  match_id          uuid not null references public.ir_matches(id) on delete cascade,
  project_id        uuid not null references public.ir_projects(id) on delete cascade,
  template          text not null,
  steps             jsonb not null,                       -- [{ day, subject, body }]
  via               text not null check (via in ('icapos', 'gmail')),
  include_one_pager boolean not null default false,
  manager_id        uuid not null references public.profiles(id),
  watcher_ids       uuid[] not null default '{}',
  notify_events     text[] not null default '{open,click,reply,meeting}',
  notify_email      boolean not null default true,
  stop_on           text[] not null default '{reply,meeting}',
  status            text not null default 'running' check (status in ('running', 'paused', 'stopped', 'completed')),
  stop_reason       text,
  next_step         integer not null default 0,
  started_at        timestamptz not null default now(),
  next_send_at      timestamptz,
  last_error        text,
  created_by        uuid not null references public.profiles(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- One live sequence per investor record.
create unique index if not exists ir_sequence_enrollments_live_idx
  on public.ir_sequence_enrollments (match_id) where status in ('running', 'paused');
create index if not exists ir_sequence_enrollments_due_idx
  on public.ir_sequence_enrollments (next_send_at) where status = 'running';
create index if not exists ir_sequence_enrollments_project_idx on public.ir_sequence_enrollments (project_id);

create table if not exists public.ir_sequence_events (
  id             uuid primary key default gen_random_uuid(),
  enrollment_id  uuid not null references public.ir_sequence_enrollments(id) on delete cascade,
  match_id       uuid not null references public.ir_matches(id) on delete cascade,
  kind           text not null check (kind in ('sent', 'open', 'click', 'reply', 'meeting', 'paused', 'resumed', 'stopped', 'completed', 'failed')),
  step           integer,
  detail         text,
  created_by     uuid references public.profiles(id),
  created_at     timestamptz not null default now()
);

create index if not exists ir_sequence_events_enrollment_idx on public.ir_sequence_events (enrollment_id, created_at);
create index if not exists ir_sequence_events_match_idx on public.ir_sequence_events (match_id);

alter table public.ir_sequence_enrollments enable row level security;
alter table public.ir_sequence_events enable row level security;
