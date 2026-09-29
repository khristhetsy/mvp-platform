-- Index the campaign attribution key.
--
-- The social funnel filters contacts with `overrides->>'lead_source' in (tags)`. That is
-- an expression on a JSONB column, so no ordinary index applies: Postgres sequentially
-- scanned all ~27,000 crm_contacts rows AND detoasted each row's `overrides` blob to
-- evaluate it. Two of those per grain, per funnel computation — which the alert cron was
-- running every five minutes. It is a prime suspect for the database sitting at 97% CPU.
--
-- An expression index makes the same filter an index lookup. The composite includes
-- created_at because conversionsByTag filters on both.

create index if not exists crm_contacts_lead_source_idx
  on public.crm_contacts ((overrides->>'lead_source'))
  where overrides->>'lead_source' is not null;

-- created_on, not created_at: crm_contacts has no created_at column. It has created_on,
-- a generated TEXT column from raw->>'create_date' in "YYYY-MM-DD HH:MM:SS" form.
create index if not exists crm_contacts_lead_source_created_idx
  on public.crm_contacts ((overrides->>'lead_source'), created_on)
  where overrides->>'lead_source' is not null;
