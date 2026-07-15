-- Per-department contact visibility. When contacts_see_all = true, that department's
-- members see ALL contacts (like Marketing, for campaigns/segmentation) instead of
-- only their Lead-assigned contacts. The Admin department bypasses scoping in code, so
-- it needs no flag. This governs VISIBILITY only — assignment/reassign stays admin-only.

alter table public.departments
  add column if not exists contacts_see_all boolean not null default false;

-- Marketing sees all contacts by decision; every other non-admin department stays
-- scoped to Lead-assigned contacts (the default false).
update public.departments set contacts_see_all = true where key = 'marketing';
