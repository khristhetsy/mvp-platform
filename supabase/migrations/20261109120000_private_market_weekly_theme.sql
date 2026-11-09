-- Weekly emailer: theme preset from the template editor. 'navy' is the existing weekly look.
alter table public.private_market_weekly_emails
  add column if not exists theme_id text not null default 'navy';
