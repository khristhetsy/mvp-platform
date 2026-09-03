-- Department tag + archive flag for marketing contact lists, so the Lists page
-- can group/sort by department (like templates & campaigns) and hide archived
-- lists by default. department is nullable (null → "Unassigned"); archived
-- defaults false so existing lists stay visible.

alter table public.marketing_lists
  add column if not exists department text,
  add column if not exists archived boolean not null default false;
