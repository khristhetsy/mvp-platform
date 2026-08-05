-- Per-event immersive lobby background image. When set, the virtual lobby
-- renders this image (e.g. a 3D venue render) behind the hotspots instead of the
-- default grid floor. Stored in the existing public event-banners bucket.
--
-- Additive + idempotent — safe to apply on staging first, then production.

alter table public.events
  add column if not exists lobby_background_path text;

comment on column public.events.lobby_background_path is
  'Storage path (event-banners bucket) of the immersive lobby background image. Null = default grid lobby.';
