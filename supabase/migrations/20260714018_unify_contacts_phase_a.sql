-- Unify Contacts — PHASE A only (safe, additive, reversible). Builds the mapping from
-- marketing_contacts → crm_contacts. Does NOT touch foreign keys or delete anything.
-- Reversible: drop marketing_contacts.crm_contact_id to undo the mapping.
--
-- Decisions (confirmed): create crm rows for marketing-only contacts, union tags onto
-- matched rows, leave owner/assignee empty (admins-only until Lead-assigned).

-- 0) Mapping column.
alter table public.marketing_contacts
  add column if not exists crm_contact_id uuid references public.crm_contacts(id) on delete set null;

-- 1) Match existing CRM rows by email (case-insensitive). If an email maps to multiple
--    CRM rows (source duplicates), Postgres picks one — fine for the mapping.
update public.marketing_contacts m
set crm_contact_id = c.id
from public.crm_contacts c
where lower(c.email) = lower(m.email)
  and m.crm_contact_id is null;

-- 2) Create CRM rows for marketing-only contacts, keyed on (source='marketing',
--    external_id = marketing id) so this is idempotent. Owner/assignee left empty.
insert into public.crm_contacts (source, external_id, module, email, name, company, tags)
select 'marketing', m.id::text, 'unknown', m.email,
       nullif(trim(concat_ws(' ', m.first_name, m.last_name)), ''),
       m.company, coalesce(m.tags, '{}')
from public.marketing_contacts m
where m.crm_contact_id is null
on conflict (source, external_id) do nothing;

-- 2b) Map those newly-created rows back.
update public.marketing_contacts m
set crm_contact_id = c.id
from public.crm_contacts c
where c.source = 'marketing' and c.external_id = m.id::text
  and m.crm_contact_id is null;

-- 3) Union marketing tags onto the matched CRM rows.
update public.crm_contacts c
set tags = (select array(select distinct unnest(coalesce(c.tags, '{}') || coalesce(m.tags, '{}'))))
from public.marketing_contacts m
where m.crm_contact_id = c.id
  and coalesce(array_length(m.tags, 1), 0) > 0;
