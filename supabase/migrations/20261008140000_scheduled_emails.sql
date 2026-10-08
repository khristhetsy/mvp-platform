-- Schedule send for every staff send point (Contracts, Gmail compose and reply,
-- Draft email panel, CRM record email, Investor Relations match emails, Sales
-- chatter, Mass email). The send request is stored exactly as the button would
-- have posted it, and /api/cron/scheduled-emails replays it through the same
-- send route as the person who scheduled it when send_at arrives. Nothing the
-- send does (PDFs, stage moves, to-dos, timeline entries) happens before then.
--
-- RLS: on, with one policy: a signed in person can read their own rows. All
-- writes go through the admin API with the service role.

create table if not exists public.scheduled_emails (
  id           uuid primary key default gen_random_uuid(),
  created_by   uuid not null references public.profiles(id) on delete cascade,
  kind         text not null check (kind in (
                 'contracts', 'gmail_send', 'gmail_reply', 'ir_match_email',
                 'sales_chatter', 'mass_email')),
  -- The JSON body the send route receives, and its URL params (match id, thread id).
  payload      jsonb not null,
  params       jsonb not null default '{}'::jsonb,
  -- What the list shows: who it goes to, the subject, and where it came from.
  to_label     text not null default '',
  subject      text not null default '',
  -- Lets a page find its own pending sends (contact id, match id, thread id).
  context_key  text,
  send_at      timestamptz not null,
  status       text not null default 'scheduled'
               check (status in ('scheduled', 'sending', 'sent', 'canceled', 'failed')),
  attempts     integer not null default 0,
  sent_at      timestamptz,
  error        text,
  result       jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists scheduled_emails_due_idx
  on public.scheduled_emails (send_at) where status = 'scheduled';
create index if not exists scheduled_emails_created_by_idx
  on public.scheduled_emails (created_by, send_at desc);
create index if not exists scheduled_emails_context_idx
  on public.scheduled_emails (kind, context_key) where context_key is not null;

alter table public.scheduled_emails enable row level security;

drop policy if exists "scheduled_emails_select_own" on public.scheduled_emails;
create policy "scheduled_emails_select_own"
  on public.scheduled_emails for select
  to authenticated
  using (created_by = auth.uid());
