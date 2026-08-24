-- Booth video + contact request for sponsors.
--
-- A sponsor booth can carry a video: either a pasted link (video_provider='external',
-- video_ref = the URL) or an uploaded file (video_provider='recorded', video_ref = a
-- storage path in the private event-sponsor-videos bucket). Mirrors the sessions
-- video model so the same players/embeds render it.
--
-- allow_contact_request toggles the existing opt-in intro button on the booth page.

alter table public.sponsors add column if not exists video_provider text;
alter table public.sponsors add column if not exists video_ref text;
alter table public.sponsors add column if not exists allow_contact_request boolean not null default true;

-- Private bucket for uploaded booth videos; served via short-lived signed URLs.
insert into storage.buckets (id, name, public) values
  ('event-sponsor-videos', 'event-sponsor-videos', false)
on conflict (id) do nothing;

-- Staff manage booth videos directly; sponsor-owner uploads go through the API
-- with the service role after an ownership check, so no owner storage policy is needed.
drop policy if exists "sponsor video staff all" on storage.objects;
create policy "sponsor video staff all" on storage.objects
  for all using (
    bucket_id = 'event-sponsor-videos' and public.is_staff()
  ) with check (
    bucket_id = 'event-sponsor-videos' and public.is_staff()
  );
