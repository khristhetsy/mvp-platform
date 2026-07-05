-- Marketing campaigns — per-campaign content overrides.
-- Lets a campaign carry an edited subject / body that applies to that campaign
-- only, without touching the shared template. Null = use the template as-is.

alter table public.marketing_campaigns
  add column if not exists subject_override text,
  add column if not exists body_override text;
