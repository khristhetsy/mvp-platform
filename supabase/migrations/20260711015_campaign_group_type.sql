-- Marketing Hub fix: campaign group type (Founder / Investor / Event) set at creation,
-- drives the filter pills on the campaigns list. Nullable so existing campaigns are valid.

alter table public.marketing_campaigns
  add column if not exists group_type text
  check (group_type in ('founder','investor','event'));

create index if not exists marketing_campaigns_group_type_idx
  on public.marketing_campaigns (group_type);
