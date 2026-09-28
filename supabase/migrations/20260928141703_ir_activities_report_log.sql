-- Founder report and summary sends are logged as project-level email activities (no
-- investor, no task). The original check rejected them, so those sends were never
-- recorded and the report route failed after the email had gone out. Allow exactly
-- that case; every other activity still needs an investor or a task.
alter table public.ir_activities drop constraint if exists ir_activities_check;
alter table public.ir_activities add constraint ir_activities_check
  check (match_id is not null or task_id is not null or (type = 'email' and subject like 'Founder report sent%'));
