-- Meetings tab on an IR task: contacts linked to the task, like Odoo's Meetings list.
-- Option A: a link table, so these contacts do NOT become ir_matches (no change to Matching tab counts).
-- Extra contact fields (phone2, EIN, operator licence, CURP, portal plan, language, job position, city)
-- are stored in crm_contacts.profile (jsonb), so no column changes on the 30k row table.
-- Access: RLS on, staff (public.is_staff()) read/write. Not applied yet.

create table if not exists public.ir_task_meeting_contacts (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid not null references public.ir_tasks(id) on delete cascade,
  contact_id  uuid not null references public.crm_contacts(id) on delete cascade,
  created_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now(),
  unique (task_id, contact_id)
);
create index if not exists ir_task_meeting_contacts_task_idx    on public.ir_task_meeting_contacts (task_id);
create index if not exists ir_task_meeting_contacts_contact_idx on public.ir_task_meeting_contacts (contact_id);

alter table public.ir_task_meeting_contacts enable row level security;

drop policy if exists ir_task_meeting_contacts_staff on public.ir_task_meeting_contacts;
create policy ir_task_meeting_contacts_staff on public.ir_task_meeting_contacts
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

revoke all on public.ir_task_meeting_contacts from anon;
