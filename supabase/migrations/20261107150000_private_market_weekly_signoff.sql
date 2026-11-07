-- Weekly emailer: optional "Written by NAME" line under the note. Null prints nothing.
-- Also repeats the header columns from 20261107140000 so this file is safe to run on its own.
alter table public.private_market_weekly_emails
  add column if not exists header_mode text not null default 'std',
  add column if not exists banner_url text,
  add column if not exists banner_strip boolean not null default true,
  add column if not exists sign_off text;
