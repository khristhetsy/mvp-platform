-- Presenter company logo. The brochure avatar falls back headshot -> company
-- logo -> initials, and the logo also sits in the presenter's company box.
-- Files live in the existing private event-presenter-headshots bucket
-- (staff-only policy already covers it) under <presenterId>/logo-*.
alter table public.event_presenters add column if not exists company_logo_path text;
