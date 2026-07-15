# Plan — Unify Marketing contacts into the universal Contacts (`crm_contacts`)

Status: **proposal for review — nothing executed.** Part 1 (top-level universal Contacts nav) is already shipped (`c835e13`). This is Part 2.

## Goal
One shared contact store (`crm_contacts`) used by every department. Retire the separate
`marketing_contacts` table so Marketing campaigns/sequences/lists operate on the same
records as Sales/IR, each member scoped by Lead assign.

## Current state
- **`crm_contacts`** — canonical store (~12,330). Columns: `id, source, external_id, name,
  email, company, phone, website, lead_status, tags[], owner_id, assignee_ids[], raw,
  overrides, …`. Contacts profile, Sales, IR read this.
- **`marketing_contacts`** — separate store (~21,520). Columns: `id, email (unique),
  first_name, last_name, company, title, source, tags[], metadata`. Mirrored from
  `crm_contacts` by email, plus CSV imports and cold adds.
- **References to `marketing_contacts.id`** (all `on delete cascade`):
  - `marketing_list_contacts.contact_id`  (PK `list_id, contact_id`)
  - `marketing_sequence_enrollments.contact_id`  (unique `sequence_id, contact_id`)
  - `marketing_events.contact_id`

## The key wrinkle
Marketing has **~9k more** contacts than CRM (21.5k vs 12.3k). Many marketing rows have
**no matching `crm_contacts` row**. "One store" means those marketing-only contacts must
be **created in `crm_contacts`**. That's the main decision to confirm (below).

## Decisions needed before executing
1. **Marketing-only contacts** (no CRM match by email): create them in `crm_contacts`
   (`source = 'marketing'`, split `first_name/last_name` → `name`)? — recommended **yes**,
   otherwise they'd be orphaned.
2. **Tags**: union `marketing_contacts.tags` into `crm_contacts.tags` on matched rows? —
   recommended **yes**.
3. **Owner/assignee for imported marketing contacts**: leave `owner_id`/`assignee_ids`
   empty (so only admins see them until assigned)? — recommended **yes**, consistent with
   the Lead-assign model.

## Migration — staged & reversible

### Phase A — Build the mapping (safe, additive, reversible)
```sql
alter table public.marketing_contacts add column if not exists crm_contact_id uuid
  references public.crm_contacts(id) on delete set null;

-- A1. Match existing CRM rows by email.
update public.marketing_contacts m
set crm_contact_id = c.id
from public.crm_contacts c
where lower(c.email) = lower(m.email) and m.crm_contact_id is null;

-- A2. Create CRM rows for marketing-only contacts (decision #1 = yes).
insert into public.crm_contacts (source, email, name, company, tags)
select 'marketing', m.email,
       nullif(trim(concat_ws(' ', m.first_name, m.last_name)), ''),
       m.company, coalesce(m.tags, '{}')
from public.marketing_contacts m
where m.crm_contact_id is null
on conflict (email) do nothing;   -- assumes/adds a unique index on crm_contacts(lower(email))

update public.marketing_contacts m
set crm_contact_id = c.id
from public.crm_contacts c
where lower(c.email) = lower(m.email) and m.crm_contact_id is null;

-- A3. (decision #2) Union tags onto matched CRM rows.
update public.crm_contacts c
set tags = (select array(select distinct unnest(coalesce(c.tags,'{}') || coalesce(m.tags,'{}'))))
from public.marketing_contacts m
where m.crm_contact_id = c.id and coalesce(array_length(m.tags,1),0) > 0;
```
After Phase A: every `marketing_contacts` row has a `crm_contact_id`. **Verify** count of
nulls is 0 before proceeding.

### Phase B — Repoint the three FK tables to `crm_contacts` (the irreversible step)
Do inside a transaction, after a DB backup. Handle dedupe (two marketing rows mapping to
one CRM row):
```sql
begin;

-- list membership
alter table public.marketing_list_contacts drop constraint marketing_list_contacts_contact_id_fkey;
update public.marketing_list_contacts lc set contact_id = m.crm_contact_id
  from public.marketing_contacts m where m.id = lc.contact_id;
delete from public.marketing_list_contacts a using public.marketing_list_contacts b   -- dedupe PK
  where a.ctid < b.ctid and a.list_id = b.list_id and a.contact_id = b.contact_id;
alter table public.marketing_list_contacts
  add constraint marketing_list_contacts_contact_id_fkey
  foreign key (contact_id) references public.crm_contacts(id) on delete cascade;

-- sequence enrollments  (repeat pattern; dedupe on sequence_id, contact_id)
-- marketing_events       (repeat pattern; no unique to dedupe, just repoint)

commit;
```

### Phase C — Code changes
- `src/lib/marketing/contacts.ts` → `getContacts` reads `crm_contacts` (with marketing
  filters: search/list/tag), returns the shared shape. Keep member scoping (Lead assign).
- `src/lib/marketing/sequences.ts` → `collectDueSequenceBatches`, `enrollContact`,
  `enrollList`, `releaseSequenceBatch` join `crm_contacts` for email/name.
  Name handling: `crm_contacts.name` → derive first name for `{{first_name}}` interpolation.
- `src/lib/marketing/campaigns.ts` → recipients from `crm_contacts`.
- Marketing Contacts UI (`ContactsTable.tsx`) → point at the shared list (or redirect to
  the universal Contacts page).

### Phase D — Cutover & retire
- Run Phases A→C on **staging**, verify campaigns/sequences enroll & send correctly.
- On production: Phase A, verify, Phase B (backup first), deploy Phase C.
- Keep `marketing_contacts` for one release as a safety net, then drop it.

## Rollback
- Phase A is additive — drop `crm_contact_id` to undo.
- Phase B: restore from the pre-migration backup (the FK repoint + dedupe is not trivially
  reversible in place).

## Risks
- Email-based matching mis-merges distinct people who share an email (rare).
- Dedupe deletes list/enrollment rows where two marketing contacts collapsed into one CRM
  contact — acceptable (same person) but worth logging counts.
- `{{first_name}}` personalization depends on name-splitting `crm_contacts.name`.

## Recommended sequencing
Ship Part 1 (done), let it settle, confirm decisions #1–3, run Phase A on production and
verify, then schedule Phase B+C+D as one deploy on staging → production.
