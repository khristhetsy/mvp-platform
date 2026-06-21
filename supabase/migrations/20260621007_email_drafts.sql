-- Email drafts: unsent compositions, owner-scoped. Powers the Inbox "Drafts" folder.

create table if not exists public.email_drafts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  to_email text,
  subject text,
  body text,
  attachments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists email_drafts_owner_idx on public.email_drafts(owner_id, updated_at desc);

alter table public.email_drafts enable row level security;

drop policy if exists email_drafts_owner on public.email_drafts;
create policy email_drafts_owner on public.email_drafts
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
