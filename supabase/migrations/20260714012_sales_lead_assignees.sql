-- Lead-assignable members: the set of staff who may appear in a contact's "Assigned to"
-- picker. Configured in Admin → Feature Controls. Empty/unset means no restriction
-- (all staff are eligible), preserving current behavior.

alter table public.sales_settings add column if not exists lead_assignee_ids uuid[] not null default '{}';
