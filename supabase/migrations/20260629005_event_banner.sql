-- ============================================================
-- Event banner image: a public cover image with overlay-darkness
-- (for headline legibility) and a focal point (for cropping).
-- events.cover_path already exists; add the two presentation fields
-- and a PUBLIC storage bucket so the banner renders for anyone.
-- ============================================================

alter table public.events
  add column if not exists cover_overlay integer not null default 55
    check (cover_overlay between 0 and 90),
  add column if not exists cover_focal text not null default 'center';

insert into storage.buckets (id, name, public)
values ('event-banners', 'event-banners', true)
on conflict (id) do nothing;

-- Staff manage banner objects; public read is served via the public bucket URL.
create policy "event banner staff write" on storage.objects
  for all
  using (bucket_id = 'event-banners' and public.is_staff())
  with check (bucket_id = 'event-banners' and public.is_staff());

create policy "event banner public read" on storage.objects
  for select using (bucket_id = 'event-banners');
