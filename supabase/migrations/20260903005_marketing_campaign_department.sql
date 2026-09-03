-- Department tag for marketing campaigns, so the Campaigns page can group and
-- sort by department (Sales, Investor Relations, Marketing, Administration,
-- Events) — the same axis added to marketing_templates in 20260903004.
-- Nullable — a null department renders as "Unassigned" in the UI. This is a
-- separate axis from group_type (founder/investor/event audience).

alter table public.marketing_campaigns
  add column if not exists department text;
