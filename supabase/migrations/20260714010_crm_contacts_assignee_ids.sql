-- Sales scoping: a contact has one primary owner (owner_id) plus an optional set of
-- additional assignees who can also see it. A rep sees a contact if they are the owner
-- OR appear in assignee_ids. Assignment (owner + assignees) is edited in the contact
-- profile by admins only.

alter table public.crm_contacts add column if not exists assignee_ids uuid[] not null default '{}';

-- GIN index supports the array-containment lookup used by the scoped list/facets queries
-- (assignee_ids @> array[<user>]).
create index if not exists crm_contacts_assignee_ids_idx on public.crm_contacts using gin (assignee_ids);
