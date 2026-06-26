-- Migration: 20260626008_icfo_events_showcase_extras.sql
-- iCFO Events — finishing touches:
--   §7  sponsors.downloads (booth resources) + sessions.host_sponsor_id (hosted session)
--   §3  event_presenters richer profile fields (headline, bio, links)

alter table public.sponsors
  add column if not exists downloads jsonb not null default '[]'::jsonb;

alter table public.sessions
  add column if not exists host_sponsor_id uuid references public.sponsors(id) on delete set null;
create index if not exists sessions_host_sponsor_idx on public.sessions(host_sponsor_id);

alter table public.event_presenters
  add column if not exists headline text,
  add column if not exists bio text,
  add column if not exists links jsonb not null default '[]'::jsonb;
