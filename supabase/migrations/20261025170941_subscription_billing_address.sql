-- Billing address for founders paying by bank wire. Printed on wire invoices and
-- receipts. Card customers keep theirs in the Lemon Squeezy portal.
alter table public.subscriptions
  add column if not exists billing_address jsonb;
