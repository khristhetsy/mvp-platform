-- Contacts custom filters now use jsonb containment on the ROOT of raw / overrides
-- (raw @> '{"__profile":{"industries":["Fintech"]}}') so the existing
-- crm_contacts_raw_gin index serves them. overrides had no GIN — the lead-source
-- half of that OR forced a sequential scan over every row. Same operator class.
create index if not exists crm_contacts_overrides_gin
  on public.crm_contacts using gin (overrides jsonb_path_ops);
