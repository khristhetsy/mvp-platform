-- Perf fix for the paged "all investor ids" reads on crm_contacts (~30k rows, ~7.2k investors).
--
-- Measured before this change (EXPLAIN ANALYZE, 2026-10-23):
--   count of (contact_type = 'investor' OR module = 'investor'): 457 ms, full index scan
--   one 1,000 row page of ids at OFFSET 5000: 4,254 ms, bitmap heap scan over 4,121 table
--   blocks (1,145 read from disk). Every page of a paged read also repeats the count.
--
-- A partial index on id with the exact same OR predicate lets Postgres answer both the count
-- and the id pages from a tiny index (about 7.2k entries) without touching the table.
-- The second index does the same for the plain `module = X` id reads.
--
-- After applying, run `vacuum (analyze) public.crm_contacts;` in the SQL editor (it cannot run
-- inside a migration) so index only scans can skip table lookups, then re-run the two EXPLAINs.
create index if not exists crm_contacts_investor_ids_idx
  on public.crm_contacts (id)
  where (contact_type = 'investor' or module = 'investor');

create index if not exists crm_contacts_module_id_idx
  on public.crm_contacts (module, id);
