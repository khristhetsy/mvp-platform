-- Instagram publishing. Instagram only accepts image (or video) posts, so a post
-- carries an optional public image URL; the Instagram adapter refuses to publish
-- a variant whose post has none. Instagram accounts connect through the Facebook
-- Page they're linked to (same Meta OAuth), so social_connect_invites accepts it too.

alter table public.social_posts       add column if not exists image_url text;
alter table public.social_recurrences add column if not exists image_url text;

alter table public.social_connect_invites drop constraint if exists social_connect_invites_platform_check;
alter table public.social_connect_invites
  add constraint social_connect_invites_platform_check check (platform in ('linkedin', 'facebook', 'instagram'));
