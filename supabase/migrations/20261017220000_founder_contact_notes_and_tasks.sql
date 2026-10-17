-- Founder My contacts, contact page: Note log and Tasks.
-- Notes are private to the founder who wrote them. Tasks are the founder's own clock reminders
-- (user_reminders) linked to a contact, so a task set on a contact shows in the clock menu and a
-- click on it opens that contact's Tasks tab. Idempotent.
create table if not exists public.founder_contact_notes (
  id uuid primary key default gen_random_uuid(),
  founder_id uuid not null references public.profiles(id) on delete cascade,
  contact_id uuid not null references public.founder_investor_contacts(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  pinned boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists founder_contact_notes_contact_idx
  on public.founder_contact_notes (contact_id, created_at desc);

create index if not exists founder_contact_notes_founder_idx
  on public.founder_contact_notes (founder_id);

alter table public.founder_contact_notes enable row level security;

drop policy if exists founder_contact_notes_own on public.founder_contact_notes;
create policy founder_contact_notes_own on public.founder_contact_notes
  for all to authenticated
  using (founder_id = (select auth.uid()))
  with check (founder_id = (select auth.uid()));

alter table public.user_reminders
  add column if not exists contact_id uuid references public.founder_investor_contacts(id) on delete cascade;

create index if not exists user_reminders_contact_idx
  on public.user_reminders (contact_id);
