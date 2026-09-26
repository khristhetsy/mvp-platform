-- Weekly founder match email: which investor matches each company has already
-- been told about, so "new this week" means new since the last email.
-- Written only by the cron (service role); no client access.
create table if not exists public.founder_match_digest_state (
  company_id   uuid primary key references public.companies(id) on delete cascade,
  seen_refs    text[] not null default '{}',
  last_sent_at timestamptz,
  updated_at   timestamptz not null default now()
);

alter table public.founder_match_digest_state enable row level security;
