-- Event page redesign: an admin-editable rich-text banner, a countdown toggle,
-- and organizer contact fields for the public side rail. All additive and
-- defaulted so existing events keep rendering unchanged. Re-runnable.

alter table public.events
  add column if not exists banner_title   text,
  add column if not exists banner_html    text,
  add column if not exists banner_bg      text not null default 'indigo',
  add column if not exists show_countdown boolean not null default true,
  add column if not exists organizer_name  text,
  add column if not exists organizer_phone text,
  add column if not exists organizer_email text;
