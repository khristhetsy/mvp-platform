-- Banner copy for the founder Learning overview, set per course by an admin.
-- All columns are optional: empty copy falls back to the course title and description,
-- and show_in_banner defaults to true so every published course keeps its slide. Idempotent.
alter table public.learning_programs
  add column if not exists promo_headline text,
  add column if not exists promo_blurb text,
  add column if not exists promo_cta_label text,
  add column if not exists show_in_banner boolean not null default true;
