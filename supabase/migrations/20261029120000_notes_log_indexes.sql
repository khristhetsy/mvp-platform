-- Notes log: make every auto-logged communication safe to write twice.
-- Each logged send, call or reply carries meta->>'external_id' (Gmail message id,
-- email_log.id, call_attempts.id). One row per contact, opportunity, kind and
-- external id. opportunity_id is part of the key because one email to a contact
-- with two open opportunities logs one row per opportunity (logOutboundEmailActivity).
-- NULLS NOT DISTINCT (Postgres 15+) so contact-level rows (opportunity_id null)
-- still collide with each other. Rows without an external_id are not affected.
-- No table, column or RLS change.

create unique index if not exists sales_activity_log_external_uq
  on public.sales_activity_log (contact_crm_id, opportunity_id, kind, (meta->>'external_id'))
  nulls not distinct
  where meta->>'external_id' is not null;
