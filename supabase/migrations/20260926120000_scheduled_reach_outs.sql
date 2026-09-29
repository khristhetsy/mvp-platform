-- Reach out to founder emails scheduled for later (Admin, company workspace,
-- Reach out to founder, Schedule). The email is stored as it will be sent,
-- signature included, and /api/cron/scheduled-reach-outs sends it at send_at.
-- Staff read and change rows through the admin API with the service role, so
-- RLS is on with no policies: nothing is reachable with a user's own key.

create table if not exists public.scheduled_reach_outs (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  founder_id  uuid not null references public.profiles(id) on delete cascade,
  created_by  uuid not null references public.profiles(id) on delete cascade,
  to_email    text not null,
  subject     text not null,
  body        text not null,
  html        text not null,
  via         text not null check (via in ('icapos', 'gmail')),
  reply_to    text,
  also_nudge  boolean not null default false,
  send_at     timestamptz not null,
  status      text not null default 'scheduled'
              check (status in ('scheduled', 'sending', 'sent', 'canceled', 'failed')),
  sent_at     timestamptz,
  channel     text,
  error       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists scheduled_reach_outs_due_idx
  on public.scheduled_reach_outs (send_at) where status = 'scheduled';
create index if not exists scheduled_reach_outs_company_idx on public.scheduled_reach_outs (company_id);
create index if not exists scheduled_reach_outs_founder_idx on public.scheduled_reach_outs (founder_id);
create index if not exists scheduled_reach_outs_created_by_idx on public.scheduled_reach_outs (created_by);

alter table public.scheduled_reach_outs enable row level security;
