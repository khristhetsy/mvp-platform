-- CapitalOS-side "read" memory for Gmail threads. Because the Gmail integration
-- is read-only (no gmail.modify), we can't clear Gmail's UNREAD label — so we
-- record which Gmail threads the user has opened inside CapitalOS and treat them
-- as read in our own UI/badges. Owner-scoped, additive.

create table if not exists public.gmail_read_marks (
  owner_id        uuid not null references public.profiles(id) on delete cascade,
  gmail_thread_id text not null,
  read_at         timestamptz not null default now(),
  primary key (owner_id, gmail_thread_id)
);

create index if not exists gmail_read_marks_owner_idx on public.gmail_read_marks(owner_id);

alter table public.gmail_read_marks enable row level security;

drop policy if exists gmail_read_marks_owner on public.gmail_read_marks;
create policy gmail_read_marks_owner on public.gmail_read_marks
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
