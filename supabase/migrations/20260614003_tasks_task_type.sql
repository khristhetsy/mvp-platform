-- Add task_type column for founder task categorisation
-- Learning | Operations | Investor Outreach | Deal & Diligence
alter table tasks add column if not exists task_type text;
