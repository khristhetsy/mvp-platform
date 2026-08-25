-- Voice re-consent tracking. The command-center consent funnel shows a
-- "Re-consent sent" band for cold Odoo leads that were emailed/texted a
-- re-consent request but haven't re-consented yet. Until this is applied the
-- band renders as "—" (the aggregator degrades gracefully when the column is
-- absent). Additive + backward-compatible: existing rows default to 'none'.
--
-- Apply on staging, verify, then production (migrations need human approval).

alter table public.consent_records
  add column if not exists reconsent_status text not null default 'none'
  check (reconsent_status in ('none', 'sent', 'confirmed', 'declined'));

alter table public.consent_records
  add column if not exists reconsent_sent_at timestamptz;

-- Partial index: the funnel only ever counts the 'sent' (pending) rows.
create index if not exists consent_records_reconsent_sent_idx
  on public.consent_records (reconsent_status)
  where reconsent_status = 'sent';
