alter table public.investor_outreach_recipients
  add column if not exists email text;
