-- Weekly emailer: optional banner image in place of the logo and title block.
alter table public.private_market_weekly_emails
  add column if not exists header_mode  text not null default 'std' check (header_mode in ('std', 'banner')),
  add column if not exists banner_url   text,
  add column if not exists banner_strip boolean not null default true;
