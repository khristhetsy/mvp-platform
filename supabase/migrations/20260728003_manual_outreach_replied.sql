alter table public.founder_manual_outreach_recipients
  add column if not exists replied_at timestamptz;
