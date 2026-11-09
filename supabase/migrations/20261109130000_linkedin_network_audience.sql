-- LinkedIn outreach: people read straight from your own LinkedIn 1st connections (no CRM link).
-- One person once per campaign, by profile slug. Rows from the CRM have a contact id and keep their own index.
create unique index if not exists linkedin_targets_campaign_slug_idx
  on public.linkedin_targets (campaign_id, linkedin_slug)
  where contact_id is null and linkedin_slug is not null;
