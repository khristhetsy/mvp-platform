-- Archive for Investor Relations weekly tasks. Archived tasks keep their investors,
-- activities and messages but are hidden from the task boards until unarchived.
alter table public.ir_tasks add column if not exists archived_at timestamptz;
comment on column public.ir_tasks.archived_at is 'Set when staff archive the weekly task; archived tasks are hidden from the task boards until unarchived.';
