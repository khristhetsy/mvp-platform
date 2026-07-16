-- Efficiency: the Contacts search box filters with ILIKE '%text%' on name/company/
-- email/phone. Leading-wildcard ILIKE can't use a btree index, so each search
-- seq-scans the whole table. Trigram (pg_trgm) GIN indexes make substring search
-- index-backed — faster now (~24k rows) and scalable as the CRM grows. Additive only.

create extension if not exists pg_trgm;

create index if not exists crm_contacts_name_trgm    on public.crm_contacts using gin (name gin_trgm_ops);
create index if not exists crm_contacts_company_trgm on public.crm_contacts using gin (company gin_trgm_ops);
create index if not exists crm_contacts_email_trgm   on public.crm_contacts using gin (email gin_trgm_ops);
create index if not exists crm_contacts_phone_trgm   on public.crm_contacts using gin (phone gin_trgm_ops);
