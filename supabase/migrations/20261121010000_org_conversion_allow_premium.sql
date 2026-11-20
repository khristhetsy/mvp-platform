alter table public.organizations
  drop constraint if exists organizations_conversion_plan_check;

alter table public.organizations
  add constraint organizations_conversion_plan_check
  check (conversion_plan is null or conversion_plan in ('founder_basic','founder_professional','founder_premium'));
