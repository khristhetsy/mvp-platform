-- Presenter roster details: company summary, a Google Meet link, and a scheduled
-- slot (start time + IANA timezone). `email` supports manually-added presenters
-- that aren't tied to a platform profile.
alter table public.event_presenters add column if not exists company_summary text;
alter table public.event_presenters add column if not exists meeting_url text;
alter table public.event_presenters add column if not exists starts_at timestamptz;
alter table public.event_presenters add column if not exists timezone text;
alter table public.event_presenters add column if not exists email text;
