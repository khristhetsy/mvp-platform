-- Sales scoping: each contact/lead has a single owner (a staff profile). Reps see
-- only their own records; managers see all. sales_opportunities already has owner_id;
-- add the matching column to crm_contacts.

alter table public.crm_contacts add column if not exists owner_id uuid references public.profiles(id) on delete set null;
create index if not exists crm_contacts_owner_idx on public.crm_contacts (owner_id);
