-- Email suppression list for investor outreach (CAN-SPAM). A recipient who
-- clicks unsubscribe is added here; the send pass skips any suppressed email.
-- Accessed only server-side via the service role, so RLS is on with no policies
-- (blocks anon/authenticated; service role bypasses RLS).

create table if not exists public.outreach_unsubscribes (
  email text primary key,
  created_at timestamptz not null default now()
);

alter table public.outreach_unsubscribes enable row level security;
