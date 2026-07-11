-- Weekly Meeting System — marketing workbook: email schedule + campaign results (spec §2.4).
-- email_campaign_schedule: the weekly topic/audience plan (platform resend|sendgrid, never
-- Odoo). campaign_results: per-strategy outreach outcomes; rates (MR%/PR%/meeting%) are
-- computed in the app layer (no sheet #DIV/0!). ROMI is aggregated from these results.

create table if not exists public.ceo_email_campaign_schedule (
  id                  uuid primary key default gen_random_uuid(),
  week_start          date not null,
  topic               text not null,
  audience            text not null,                  -- Investors | Entrepreneurs | Registrants
  platform            text not null default 'resend'
                        check (platform in ('resend','sendgrid')),
  scheduled_date      date,
  status              text not null default 'draft'
                        check (status in ('draft','scheduled','sent')),
  provider_message_id text,
  linked_event_id     uuid,
  created_by          uuid references public.profiles(id),
  created_at          timestamptz not null default now()
);
create index if not exists ceo_email_campaign_schedule_week_idx
  on public.ceo_email_campaign_schedule (week_start desc);

create table if not exists public.ceo_campaign_results (
  id               uuid primary key default gen_random_uuid(),
  agent_id         uuid references public.profiles(id),
  strategy         text not null,                     -- e.g. 'Posting Campaign E071426'
  run_date         date not null,
  impressions      int not null default 0,
  members_reached  int not null default 0,
  positive_replies int not null default 0,
  meetings         int not null default 0,
  created_by       uuid references public.profiles(id),
  created_at       timestamptz not null default now()
);
create index if not exists ceo_campaign_results_run_idx
  on public.ceo_campaign_results (run_date desc);

alter table public.ceo_email_campaign_schedule enable row level security;
alter table public.ceo_campaign_results enable row level security;

drop policy if exists ceo_email_campaign_schedule_staff on public.ceo_email_campaign_schedule;
create policy ceo_email_campaign_schedule_staff on public.ceo_email_campaign_schedule
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists ceo_campaign_results_staff on public.ceo_campaign_results;
create policy ceo_campaign_results_staff on public.ceo_campaign_results
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

grant select, insert, update, delete on public.ceo_email_campaign_schedule to service_role;
grant select, insert, update, delete on public.ceo_campaign_results to service_role;
