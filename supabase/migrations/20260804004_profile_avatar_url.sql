-- Profile photo URL.
--
-- Populated automatically from the photo a user's OAuth provider (Google /
-- LinkedIn) returns at sign-in, and shown as their avatar (with initials as the
-- fallback). Nullable and additive — safe to apply on staging then production.

alter table public.profiles
  add column if not exists avatar_url text;

comment on column public.profiles.avatar_url is
  'Profile photo URL (e.g. from Google/LinkedIn sign-in). Null = show initials avatar.';
