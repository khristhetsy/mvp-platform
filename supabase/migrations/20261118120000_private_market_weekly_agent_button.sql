-- Weekly emailer: the live AI Agent the email's second button talks to. Null shows no second button.
alter table public.private_market_weekly_emails
  add column if not exists agent_id uuid references public.ir_agents(id) on delete set null;
