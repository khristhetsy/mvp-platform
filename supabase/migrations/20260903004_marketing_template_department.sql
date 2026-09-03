-- Department tag for marketing email templates, so the Templates library can group
-- and sort by department (Sales, Investor Relations, Marketing, Administration,
-- Events). Nullable — a null department renders as "Unassigned" in the UI.

alter table public.marketing_templates
  add column if not exists department text;
