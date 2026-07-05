-- Marketing campaigns — archive flag. Lets old campaigns be hidden from the
-- default list without deleting their record or stats (reversible).

alter table public.marketing_campaigns
  add column if not exists archived boolean not null default false;
