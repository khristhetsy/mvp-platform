alter table public.investor_outreach_recipients
  add column if not exists clicked_at timestamptz;

alter table public.founder_manual_outreach_recipients
  add column if not exists clicked_at timestamptz;
