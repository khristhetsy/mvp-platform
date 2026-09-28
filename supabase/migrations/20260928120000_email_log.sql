-- Every email the platform sends, whoever triggered it: scheduled jobs, staff
-- actions, founder and investor actions. One row per send, with who it went to
-- (founder, investor, staff or external), what triggered it, and what Resend
-- reported afterwards (delivered, opened, clicked, bounced, complained).
-- Read by Admin, Activity, Sent. Written with the service role only, so RLS is
-- on with no policies. Rows older than 180 days are pruned as new ones arrive.

create table if not exists public.email_log (
  id                 bigserial primary key,
  created_at         timestamptz not null default now(),
  to_email           text not null,
  recipient_user_id  uuid references public.profiles(id) on delete set null,
  recipient_role     text not null default 'external'
                     check (recipient_role in ('founder', 'investor', 'staff', 'external')),
  subject            text not null,
  body_html          text,
  body_text          text,
  source             text not null default 'app',
  job                text,
  run_id             bigint,
  triggered_by       uuid references public.profiles(id) on delete set null,
  status             text not null check (status in ('sent', 'failed', 'skipped')),
  error              text,
  provider_id        text,
  delivered_at       timestamptz,
  opened_at          timestamptz,
  clicked_at         timestamptz,
  bounced_at         timestamptz,
  complained_at      timestamptz,
  last_event         text,
  last_event_at      timestamptz
);

create index if not exists email_log_created_idx   on public.email_log (created_at desc);
create index if not exists email_log_role_idx      on public.email_log (recipient_role, created_at desc);
create index if not exists email_log_recipient_idx on public.email_log (recipient_user_id, created_at desc);
create index if not exists email_log_to_idx        on public.email_log (lower(to_email));
create index if not exists email_log_provider_idx  on public.email_log (provider_id) where provider_id is not null;

alter table public.email_log enable row level security;
