-- Give the match index a SOURCE-side watermark.
--
-- The incremental rebuild derived "what changed since last time" from
-- max(investor_match_index.updated_at). But updated_at is a PROJECTION timestamp, and
-- reindexContacts() also writes it on every enrichment approval, job-title backfill and
-- type derivation. So a single-contact reindex advanced the watermark for the whole
-- table, and the next scheduled rebuild then asked for `synced_at > (that later time)` —
-- skipping every contact Odoo had actually synced in between, permanently.
--
-- The cron made this near-certain: it runs derivation (which reindexes) immediately
-- before the rebuild, so in any run where derivation touched even one contact, the
-- rebuild in that same run saw nothing.
--
-- source_synced_at records the crm_contacts.synced_at the projection was built from, so
-- the watermark is a fact about the SOURCE and cannot be moved by our own bookkeeping.
-- Left null by reindexContacts on purpose — a targeted reindex says nothing about how far
-- the bulk scan has progressed.

alter table public.investor_match_index
  add column if not exists source_synced_at timestamptz;

create index if not exists investor_match_index_source_synced_idx
  on public.investor_match_index (source_synced_at desc nulls last);
