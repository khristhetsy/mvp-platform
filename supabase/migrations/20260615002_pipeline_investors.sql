-- ============================================================
-- pipeline_investors: founder-owned investor tracking table
-- ============================================================

create table if not exists public.pipeline_investors (
  id               uuid          primary key default gen_random_uuid(),
  founder_id       uuid          not null references auth.users(id) on delete cascade,
  name             text          not null,
  location         text,
  investor_type    text          not null default 'Venture Capital',
  investment_size  text,
  pledge_amount    numeric(14,2),
  interested       boolean       not null default false,
  meeting_requested text         not null default 'none'
    check (meeting_requested in ('none','requested','scheduled')),
  match_score      integer       check (match_score >= 0 and match_score <= 100),
  outreach_status  text          not null default 'not_started'
    check (outreach_status in ('not_started','contacted','in_progress','closed')),
  -- Contact details stored for admin/platform use only — NEVER exposed to founder
  contact_email    text,
  contact_phone    text,
  -- Additional profile fields
  preferred_stages text[],
  focus_sectors    text[],
  notes            text,
  created_at       timestamptz   not null default now(),
  updated_at       timestamptz   not null default now()
);

-- RLS: founders can only access their own rows
alter table public.pipeline_investors enable row level security;

drop policy if exists "pipeline_investors_founder_own" on public.pipeline_investors;
create policy "pipeline_investors_founder_own"
  on public.pipeline_investors
  for all
  to authenticated
  using  (founder_id = auth.uid())
  with check (founder_id = auth.uid());

-- updated_at trigger
create or replace function public.set_pipeline_investors_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists pipeline_investors_updated_at on public.pipeline_investors;
create trigger pipeline_investors_updated_at
  before update on public.pipeline_investors
  for each row execute procedure public.set_pipeline_investors_updated_at();

-- Performance index
create index if not exists pipeline_investors_founder_id_idx
  on public.pipeline_investors (founder_id);
