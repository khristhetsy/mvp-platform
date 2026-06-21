-- ============================================================================
-- Due Diligence Reporting Module — Phase 1: schema + RLS + seed fn + buckets.
--
-- All tables are prefixed `dd_` to namespace the module and avoid collisions
-- with existing tables (e.g. the existing public.documents). Role model adapted
-- to this repo: staff (public.is_staff()) have global admin access; the
-- dd_engagement_members table scopes founders/investors to a single engagement.
-- Consent uses the in-house e-signature module (dd_consent_envelopes links to a
-- signature_requests envelope), not an external provider.
-- ============================================================================

-- ── Tables ──────────────────────────────────────────────────────────────────
create table if not exists public.dd_engagements (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  company_slug text unique not null,
  round_label text,
  sector text,
  report_code text not null,
  lifecycle_stage text not null default 'draft'
    check (lifecycle_stage in ('draft','sent_to_founder','responding','admin_review',
      'consent_requested','consented_locked','released')),
  posture text,
  recommendation text,
  confidence_pct int not null default 0,
  owner_id uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dd_engagement_members (
  engagement_id uuid not null references public.dd_engagements(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('admin','founder','investor')),
  created_at timestamptz not null default now(),
  primary key (engagement_id, user_id)
);
create index if not exists dd_engagement_members_user_idx on public.dd_engagement_members(user_id);

create table if not exists public.dd_domains (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references public.dd_engagements(id) on delete cascade,
  code text not null,
  name text not null,
  overview text,
  strengths jsonb not null default '[]',
  mitigation jsonb not null default '[]',
  conclusion text,
  risk_rating text check (risk_rating in ('high','medium','low')),
  sort_order int,
  unique (engagement_id, code)
);
create index if not exists dd_domains_eng_idx on public.dd_domains(engagement_id);

create table if not exists public.dd_findings (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references public.dd_engagements(id) on delete cascade,
  finding_code text not null,
  domain_id uuid references public.dd_domains(id),
  title text not null,
  detail text,
  severity text not null check (severity in ('high','medium','low')),
  status text not null default 'open' check (status in ('open','mitigating','resolved')),
  verification text not null default 'unverified'
    check (verification in ('unverified','requested','submitted','verified','discrepancy')),
  source text,
  internal_note text,                                  -- candor layer, ADMIN ONLY
  created_at timestamptz not null default now(),
  unique (engagement_id, finding_code)
);
create index if not exists dd_findings_eng_idx on public.dd_findings(engagement_id);

create table if not exists public.dd_claims (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references public.dd_engagements(id) on delete cascade,
  claim text not null,
  claimed_value text,
  source_asserted text,
  verification text not null default 'unverified'
    check (verification in ('unverified','requested','submitted','verified','discrepancy')),
  finding_id uuid references public.dd_findings(id),
  weight int not null default 1
);
create index if not exists dd_claims_eng_idx on public.dd_claims(engagement_id);

create table if not exists public.dd_documents (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references public.dd_engagements(id) on delete cascade,
  storage_path text not null,
  filename text not null,
  uploaded_by uuid references public.profiles(id),
  uploaded_at timestamptz not null default now()
);
create index if not exists dd_documents_eng_idx on public.dd_documents(engagement_id);

create table if not exists public.dd_doc_requests (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references public.dd_engagements(id) on delete cascade,
  category text not null,
  label text not null,
  closes_findings text[] not null default '{}',
  owner_role text,
  due_date date,
  status text not null default 'requested' check (status in ('requested','submitted','verified')),
  document_id uuid references public.dd_documents(id)
);
create index if not exists dd_doc_requests_eng_idx on public.dd_doc_requests(engagement_id);

create table if not exists public.dd_responses (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references public.dd_engagements(id) on delete cascade,
  finding_codes text[] not null,
  body text not null,
  disposition text not null check (disposition in ('agree','remediating','clarify','dispute','awaiting')),
  owner_role text,
  due_date date,
  evidence_doc_id uuid references public.dd_documents(id),
  icfo_review text not null default 'open' check (icfo_review in ('accepted','needs_more','open')),
  submitted_by uuid references public.profiles(id),
  submitted_at timestamptz,
  locked boolean not null default false
);
create index if not exists dd_responses_eng_idx on public.dd_responses(engagement_id);

create table if not exists public.dd_conditions (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references public.dd_engagements(id) on delete cascade,
  label text not null,
  detail text,
  status text not null default 'not_started' check (status in ('not_started','in_progress','done')),
  sort_order int
);
create index if not exists dd_conditions_eng_idx on public.dd_conditions(engagement_id);

create table if not exists public.dd_visibility_gate (
  engagement_id uuid not null references public.dd_engagements(id) on delete cascade,
  section text not null,            -- findings, responses, data_room, candor, icfo_review, verdict
  founder_visible boolean not null default false,
  investor_visible boolean not null default false,
  primary key (engagement_id, section)
);

create table if not exists public.dd_report_versions (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references public.dd_engagements(id) on delete cascade,
  version text not null,
  snapshot jsonb not null,
  pdf_path text,
  document_hash text,
  status text not null default 'draft' check (status in ('draft','sealed')),
  created_at timestamptz not null default now()
);
create index if not exists dd_report_versions_eng_idx on public.dd_report_versions(engagement_id);

create table if not exists public.dd_consent_envelopes (
  id uuid primary key default gen_random_uuid(),
  engagement_id uuid not null references public.dd_engagements(id) on delete cascade,
  version_id uuid references public.dd_report_versions(id),
  provider text not null default 'in_house',
  signature_request_id uuid,        -- in-house e-sign envelope (signature_requests.id)
  status text not null default 'created'
    check (status in ('created','sent','signer1_signed','completed','voided')),
  signers jsonb not null default '[]',
  certificate_path text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists dd_consent_envelopes_eng_idx on public.dd_consent_envelopes(engagement_id);

create table if not exists public.dd_audit_log (
  id bigint generated always as identity primary key,
  engagement_id uuid references public.dd_engagements(id),
  actor_id uuid references public.profiles(id),
  action text not null,
  target text,
  before jsonb,
  after jsonb,
  at timestamptz not null default now()
);
create index if not exists dd_audit_log_eng_idx on public.dd_audit_log(engagement_id);

-- ── Access helpers (security definer) ───────────────────────────────────────
-- Staff have global admin access to the module.
create or replace function public.dd_is_admin(eid uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select public.is_staff();
$$;

create or replace function public.dd_member_role(eid uuid) returns text
  language sql stable security definer set search_path = public as $$
  select role from public.dd_engagement_members where engagement_id = eid and user_id = auth.uid() limit 1;
$$;

create or replace function public.dd_gate_on(eid uuid, sec text, who text) returns boolean
  language sql stable security definer set search_path = public as $$
  select case who
    when 'founder'  then coalesce((select founder_visible  from public.dd_visibility_gate where engagement_id = eid and section = sec), false)
    when 'investor' then coalesce((select investor_visible from public.dd_visibility_gate where engagement_id = eid and section = sec), false)
    else false end;
$$;

create or replace function public.dd_is_released(eid uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select coalesce((select lifecycle_stage = 'released' from public.dd_engagements where id = eid), false);
$$;

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table public.dd_engagements        enable row level security;
alter table public.dd_engagement_members enable row level security;
alter table public.dd_domains            enable row level security;
alter table public.dd_findings           enable row level security;
alter table public.dd_claims             enable row level security;
alter table public.dd_documents          enable row level security;
alter table public.dd_doc_requests       enable row level security;
alter table public.dd_responses          enable row level security;
alter table public.dd_conditions         enable row level security;
alter table public.dd_visibility_gate    enable row level security;
alter table public.dd_report_versions    enable row level security;
alter table public.dd_consent_envelopes  enable row level security;
alter table public.dd_audit_log          enable row level security;

-- engagements
drop policy if exists dd_eng_admin on public.dd_engagements;
create policy dd_eng_admin on public.dd_engagements for all using (public.dd_is_admin(id)) with check (public.dd_is_admin(id));
drop policy if exists dd_eng_founder on public.dd_engagements;
create policy dd_eng_founder on public.dd_engagements for select using (public.dd_member_role(id) = 'founder');
drop policy if exists dd_eng_investor on public.dd_engagements;
create policy dd_eng_investor on public.dd_engagements for select
  using (public.dd_member_role(id) = 'investor' and lifecycle_stage = 'released');

-- engagement_members
drop policy if exists dd_mem_admin on public.dd_engagement_members;
create policy dd_mem_admin on public.dd_engagement_members for all using (public.dd_is_admin(engagement_id)) with check (public.dd_is_admin(engagement_id));
drop policy if exists dd_mem_self on public.dd_engagement_members;
create policy dd_mem_self on public.dd_engagement_members for select using (user_id = auth.uid());

-- domains (founder when findings gated; investor when released + findings gated)
drop policy if exists dd_dom_admin on public.dd_domains;
create policy dd_dom_admin on public.dd_domains for all using (public.dd_is_admin(engagement_id)) with check (public.dd_is_admin(engagement_id));
drop policy if exists dd_dom_founder on public.dd_domains;
create policy dd_dom_founder on public.dd_domains for select
  using (public.dd_member_role(engagement_id) = 'founder' and public.dd_gate_on(engagement_id,'findings','founder'));
drop policy if exists dd_dom_investor on public.dd_domains;
create policy dd_dom_investor on public.dd_domains for select
  using (public.dd_member_role(engagement_id) = 'investor' and public.dd_is_released(engagement_id) and public.dd_gate_on(engagement_id,'findings','investor'));

-- findings
drop policy if exists dd_find_admin on public.dd_findings;
create policy dd_find_admin on public.dd_findings for all using (public.dd_is_admin(engagement_id)) with check (public.dd_is_admin(engagement_id));
drop policy if exists dd_find_founder on public.dd_findings;
create policy dd_find_founder on public.dd_findings for select
  using (public.dd_member_role(engagement_id) = 'founder' and public.dd_gate_on(engagement_id,'findings','founder'));
drop policy if exists dd_find_investor on public.dd_findings;
create policy dd_find_investor on public.dd_findings for select
  using (public.dd_member_role(engagement_id) = 'investor' and public.dd_is_released(engagement_id) and public.dd_gate_on(engagement_id,'findings','investor'));

-- claims (admin only)
drop policy if exists dd_claim_admin on public.dd_claims;
create policy dd_claim_admin on public.dd_claims for all using (public.dd_is_admin(engagement_id)) with check (public.dd_is_admin(engagement_id));

-- documents (admin full; founder read engagement + insert)
drop policy if exists dd_doc_admin on public.dd_documents;
create policy dd_doc_admin on public.dd_documents for all using (public.dd_is_admin(engagement_id)) with check (public.dd_is_admin(engagement_id));
drop policy if exists dd_doc_founder_read on public.dd_documents;
create policy dd_doc_founder_read on public.dd_documents for select using (public.dd_member_role(engagement_id) = 'founder');
drop policy if exists dd_doc_founder_ins on public.dd_documents;
create policy dd_doc_founder_ins on public.dd_documents for insert with check (public.dd_member_role(engagement_id) = 'founder');

-- doc_requests (admin full; founder read when data_room gated)
drop policy if exists dd_dr_admin on public.dd_doc_requests;
create policy dd_dr_admin on public.dd_doc_requests for all using (public.dd_is_admin(engagement_id)) with check (public.dd_is_admin(engagement_id));
drop policy if exists dd_dr_founder on public.dd_doc_requests;
create policy dd_dr_founder on public.dd_doc_requests for select
  using (public.dd_member_role(engagement_id) = 'founder' and public.dd_gate_on(engagement_id,'data_room','founder'));

-- responses (admin full; founder read + insert + update own pre-lock)
drop policy if exists dd_resp_admin on public.dd_responses;
create policy dd_resp_admin on public.dd_responses for all using (public.dd_is_admin(engagement_id)) with check (public.dd_is_admin(engagement_id));
drop policy if exists dd_resp_founder_read on public.dd_responses;
create policy dd_resp_founder_read on public.dd_responses for select using (public.dd_member_role(engagement_id) = 'founder');
drop policy if exists dd_resp_founder_ins on public.dd_responses;
create policy dd_resp_founder_ins on public.dd_responses for insert with check (public.dd_member_role(engagement_id) = 'founder');
drop policy if exists dd_resp_founder_upd on public.dd_responses;
create policy dd_resp_founder_upd on public.dd_responses for update
  using (public.dd_member_role(engagement_id) = 'founder' and locked = false)
  with check (public.dd_member_role(engagement_id) = 'founder' and locked = false);

-- conditions (admin full; founder when findings gated; investor when released)
drop policy if exists dd_cond_admin on public.dd_conditions;
create policy dd_cond_admin on public.dd_conditions for all using (public.dd_is_admin(engagement_id)) with check (public.dd_is_admin(engagement_id));
drop policy if exists dd_cond_founder on public.dd_conditions;
create policy dd_cond_founder on public.dd_conditions for select
  using (public.dd_member_role(engagement_id) = 'founder' and public.dd_gate_on(engagement_id,'findings','founder'));
drop policy if exists dd_cond_investor on public.dd_conditions;
create policy dd_cond_investor on public.dd_conditions for select
  using (public.dd_member_role(engagement_id) = 'investor' and public.dd_is_released(engagement_id));

-- visibility_gate (admin only — founders/investors never read the gate itself)
drop policy if exists dd_gate_admin on public.dd_visibility_gate;
create policy dd_gate_admin on public.dd_visibility_gate for all using (public.dd_is_admin(engagement_id)) with check (public.dd_is_admin(engagement_id));

-- report_versions + consent_envelopes (admin only; PDFs served via signed URLs)
drop policy if exists dd_ver_admin on public.dd_report_versions;
create policy dd_ver_admin on public.dd_report_versions for all using (public.dd_is_admin(engagement_id)) with check (public.dd_is_admin(engagement_id));
drop policy if exists dd_env_admin on public.dd_consent_envelopes;
create policy dd_env_admin on public.dd_consent_envelopes for all using (public.dd_is_admin(engagement_id)) with check (public.dd_is_admin(engagement_id));

-- audit_log (admin read only; inserts via service role; append-only)
drop policy if exists dd_audit_admin_read on public.dd_audit_log;
create policy dd_audit_admin_read on public.dd_audit_log for select using (public.dd_is_admin(engagement_id));
revoke update, delete on public.dd_audit_log from anon, authenticated;

-- ── Seed function: 5 domains + default (all-false) gate rows ─────────────────
create or replace function public.dd_seed_engagement(eid uuid) returns void
  language plpgsql security definer set search_path = public as $$
begin
  insert into public.dd_domains (engagement_id, code, name, sort_order) values
    (eid,'D-01','Structure',1),
    (eid,'D-02','Market',2),
    (eid,'D-03','Competitive',3),
    (eid,'D-04','Sales',4),
    (eid,'D-05','Financial',5)
  on conflict (engagement_id, code) do nothing;

  insert into public.dd_visibility_gate (engagement_id, section, founder_visible, investor_visible) values
    (eid,'findings',    false,false),
    (eid,'responses',   false,false),
    (eid,'data_room',   false,false),
    (eid,'candor',      false,false),
    (eid,'icfo_review', false,false),
    (eid,'verdict',     false,false)
  on conflict (engagement_id, section) do nothing;
end; $$;

-- ── Storage buckets (private) ───────────────────────────────────────────────
insert into storage.buckets (id, name, public) values
  ('dd-documents','dd-documents',false),
  ('dd-reports','dd-reports',false)
on conflict (id) do nothing;
