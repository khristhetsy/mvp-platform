-- Send only from the founder contact page: a recipient can be limited to the first
-- N steps of the Manual outreach sequence. Null keeps today's behavior (the whole sequence).
alter table public.founder_manual_outreach_recipients
  add column if not exists max_steps integer;
