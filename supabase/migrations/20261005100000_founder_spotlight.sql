-- Founder Spotlight: 3 minute pitch videos reviewed in the admin Spotlight
-- studio, played back to back from the iCFO Capital YouTube channel, with an
-- optional founder booth (a sponsors row the founder owns).
--
-- Additive only. No new tables, so existing RLS policies cover every column:
--   speaker_applications: owner read/insert, staff all  (review data stays private)
--   event_presenters:     public read on published events, staff all
--   sponsors:             public read, owner update, staff all

alter table public.speaker_applications
  add column if not exists video_path             text,
  add column if not exists video_type             text,
  add column if not exists video_bytes            bigint,
  add column if not exists video_seconds          integer check (video_seconds is null or video_seconds between 1 and 3600),
  add column if not exists video_width            integer,
  add column if not exists video_height           integer,
  add column if not exists youtube_video_id       text check (youtube_video_id is null or youtube_video_id ~ '^[A-Za-z0-9_-]{11}$'),
  add column if not exists transcript             text check (transcript is null or char_length(transcript) <= 20000),
  add column if not exists ai_review              jsonb,
  add column if not exists ai_reviewed_at         timestamptz,
  add column if not exists ai_intro               text check (ai_intro is null or char_length(ai_intro) <= 400),
  add column if not exists company_summary        text check (company_summary is null or char_length(company_summary) <= 200),
  add column if not exists wants_booth            boolean not null default false,
  add column if not exists booth_sponsor_id       uuid references public.sponsors(id) on delete set null,
  add column if not exists disclaimer_accepted_at timestamptz;

alter table public.event_presenters
  add column if not exists youtube_video_id text check (youtube_video_id is null or youtube_video_id ~ '^[A-Za-z0-9_-]{11}$'),
  add column if not exists ai_intro         text check (ai_intro is null or char_length(ai_intro) <= 400),
  add column if not exists booth_sponsor_id uuid references public.sponsors(id) on delete set null;

-- Founder booths live in the sponsors catalog so they reuse the booth page,
-- owner portal, leads and Sponsor Hall. This flag tells them apart.
alter table public.sponsors
  add column if not exists is_founder_booth boolean not null default false;

create index if not exists speaker_applications_event_kind_idx
  on public.speaker_applications (event_id, kind);
