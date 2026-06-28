-- ============================================================
-- Per-user language preference
-- Cookie drives the live UI; this persisted value lets background work
-- (emails, digests) reach the user in their chosen language.
-- ============================================================

alter table public.profiles
  add column if not exists locale text not null default 'en'
    check (locale in ('en', 'es'));
