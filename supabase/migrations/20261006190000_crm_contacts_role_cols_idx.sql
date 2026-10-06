-- Contacts group counts (Founders / Investors / Advisors / Other) read every row of
-- crm_contacts (5.6 s on 30k rows). contact_role() only needs contact_type and module,
-- so an index on those two columns lets count_contact_buckets use an index-only scan.
create index if not exists crm_contacts_role_cols_idx on public.crm_contacts (contact_type, module);
