alter table public.paid_signups drop constraint if exists paid_signups_plan_type_check;
alter table public.paid_signups
  add constraint paid_signups_plan_type_check
  check (plan_type in ('founder_basic', 'founder_professional', 'founder_premium'));
