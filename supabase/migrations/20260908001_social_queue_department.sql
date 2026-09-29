-- Social Media Hub queue: department grouping + an 'archived' variant status.

alter table public.social_posts
  add column if not exists department text;

-- Allow variants to be archived (hidden from the active queue without deleting).
alter table public.social_variants
  drop constraint if exists social_variants_status_check;
alter table public.social_variants
  add constraint social_variants_status_check
  check (status in ('queued', 'publishing', 'published', 'failed', 'skipped', 'archived'));
