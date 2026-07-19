-- Dual-lane model — Lane B (private matching) schema.
--
-- Mapped onto companies + investor_profiles (no founder_profiles table here):
--   spec founder_profile_id  -> company_id references companies(id)
--   spec investor_profile_id -> investor_profile_id references investor_profiles(id)
-- Investor ownership is investor_profiles.profile_id = auth.uid()
-- Founder ownership is companies.founder_id = auth.uid()

do $$ begin
  create type match_status as enum (
    'suggested',
    'investor_notified',
    'investor_interested',
    'founder_approved',
    'introduced',
    'declined_by_investor',
    'declined_by_founder',
    'expired'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.investor_founder_matches (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  investor_profile_id uuid not null references public.investor_profiles(id) on delete cascade,
  status match_status not null default 'suggested',

  match_score numeric not null,
  prescore_at_match numeric not null,     -- snapshot of lead_prescore at match time
  fit_score_at_match numeric not null,    -- snapshot of investor fit score
  score_breakdown jsonb,

  suggested_at timestamptz not null default now(),
  investor_responded_at timestamptz,
  founder_responded_at timestamptz,
  introduced_at timestamptz,
  expires_at timestamptz not null default (now() + interval '30 days'),

  unique (company_id, investor_profile_id)
);

create index if not exists idx_matches_investor on public.investor_founder_matches(investor_profile_id, status);
create index if not exists idx_matches_company on public.investor_founder_matches(company_id, status);

-- ── Audit trail (append-only) ─────────────────────────────────────────────────
create table if not exists public.profile_view_log (
  id bigint generated always as identity primary key,
  viewer_user_id uuid not null references auth.users(id),
  company_id uuid not null references public.companies(id),
  match_id uuid references public.investor_founder_matches(id),
  surface text not null,          -- 'match_card' | 'full_profile' | 'data_room'
  viewed_at timestamptz not null default now()
);

create index if not exists idx_view_log_company on public.profile_view_log(company_id, viewed_at);

-- ── RLS ───────────────────────────────────────────────────────────────────────
alter table public.investor_founder_matches enable row level security;

drop policy if exists "investor_read_own_matches" on public.investor_founder_matches;
create policy "investor_read_own_matches"
  on public.investor_founder_matches for select to authenticated
  using (investor_profile_id in (select id from public.investor_profiles where profile_id = auth.uid()));

drop policy if exists "founder_read_own_matches" on public.investor_founder_matches;
create policy "founder_read_own_matches"
  on public.investor_founder_matches for select to authenticated
  using (company_id in (select id from public.companies where founder_id = auth.uid()));

-- State transitions happen only via server actions using the service role, which
-- bypasses RLS — so the state machine is validated in one place (transitions.ts).
-- No client insert/update/delete policies are granted.

-- Investors may read a company row ONLY through an introduced match (additive,
-- permissive policy alongside the existing founder/admin company policies).
drop policy if exists "investor_read_introduced_companies" on public.companies;
create policy "investor_read_introduced_companies"
  on public.companies for select to authenticated
  using (
    id in (
      select m.company_id
      from public.investor_founder_matches m
      join public.investor_profiles ip on ip.id = m.investor_profile_id
      where ip.profile_id = auth.uid() and m.status = 'introduced'
    )
  );

-- Append-only audit log: no select/update/delete policies for any client role;
-- inserts happen via the service role from the server (log-profile-view.ts).
alter table public.profile_view_log enable row level security;
