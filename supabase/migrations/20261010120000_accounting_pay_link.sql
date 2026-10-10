-- Accounting pay link (approved Oct 9, 2026): the customer's pay page records
-- when they press "I've sent the payment". Staff only via the existing
-- acct_invoices RLS; the public page reads and writes through the server
-- (service role) after checking the invoice token. Safe to re-run.
alter table public.acct_invoices add column if not exists client_reported_paid_at timestamptz;
