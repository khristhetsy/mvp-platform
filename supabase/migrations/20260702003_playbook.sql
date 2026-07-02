-- /admin/playbook — self-syncing Daily Operating Console.
-- These tables hold ONLY editorial content, keyed to the admin nav registry by
-- nav_id (= the surface href). The module list itself is never duplicated here;
-- the console reads the live nav and joins this content, so it can't drift.

create table if not exists public.playbook_module (
  id           uuid primary key default gen_random_uuid(),
  nav_id       text not null unique,                 -- MUST match an admin nav item href
  block        text not null check (block in ('open','core','close')),
  sort_order   int  not null default 0,
  role_note    text,
  cadence      text not null default 'daily' check (cadence in ('daily','2-3x_week','weekly','monthly')),
  count_source text,                                  -- optional logical key → counts endpoint
  updated_at   timestamptz not null default now(),
  updated_by   uuid references auth.users(id) on delete set null
);

create table if not exists public.playbook_step (
  id        uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.playbook_module(id) on delete cascade,
  step_no   int  not null,
  body      text not null,
  unique (module_id, step_no)
);

create table if not exists public.playbook_flag (
  id        uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.playbook_module(id) on delete cascade,
  kind      text not null check (kind in ('hard_gate','guardrail')),
  label     text not null
);

-- ── RLS: admins read+write; analyst (the read-only staff role) reads ──────────
alter table public.playbook_module enable row level security;
alter table public.playbook_step   enable row level security;
alter table public.playbook_flag   enable row level security;

create policy pb_mod_read on public.playbook_module for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','analyst')));
create policy pb_mod_write on public.playbook_module for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy pb_step_read on public.playbook_step for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','analyst')));
create policy pb_step_write on public.playbook_step for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy pb_flag_read on public.playbook_flag for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','analyst')));
create policy pb_flag_write on public.playbook_flag for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- ── Seed: the daily operating loop across real admin surfaces ─────────────────
insert into public.playbook_module (nav_id, block, sort_order, role_note, cadence, count_source) values
  ('/admin/playbook',       'open',   5, 'This console — the operating playbook, self-synced to the live menu.', 'daily', null),
  ('/admin',                'open',  10, 'Overnight scan — where the platform stands this morning.', 'daily', null),
  ('/admin/actions',        'open',  20, 'The staff worklist — items the system has flagged for a human.', 'daily', null),
  ('/admin/investors',      'open',  30, 'Investor lifecycle and accreditation review.', 'daily', 'investors_pending_kyc'),
  ('/admin/companies',      'core',  40, 'Founder companies, profiles, and stage progress.', 'daily', null),
  ('/admin/crm',            'core',  50, 'Investor-relations CRM — pipeline, messages, outreach.', 'daily', null),
  ('/admin/intro-requests', 'core',  60, 'Founder ↔ investor introduction requests awaiting facilitation.', 'daily', 'intro_requests_pending'),
  ('/admin/deal-rooms',     'core',  70, 'Active deal rooms and their document/access state.', '2-3x_week', null),
  ('/admin/matching',       'core',  80, 'Founder ↔ investor matching signals and curation.', '2-3x_week', null),
  ('/admin/marketing',      'core',  90, 'Marketing hub — campaigns, sequences, AEO, plan.', 'daily', null),
  ('/admin/events',         'core', 100, 'Events — presenter applications, sponsors, sessions.', '2-3x_week', 'events_pending_applications'),
  ('/admin/compliance',     'close',110, 'Compliance events, risk flags, and the audit trail.', 'daily', null),
  ('/admin/readiness',      'close',120, 'Company readiness scores and diligence completeness.', 'weekly', null)
on conflict (nav_id) do nothing;

insert into public.playbook_step (module_id, step_no, body)
select m.id, s.step_no, s.body from public.playbook_module m
join (values
  ('/admin/playbook', 1, 'Start here each morning — this console lists every admin surface in operating order.'),
  ('/admin/playbook', 2, 'Work the **Open**, **Core**, then **Close** blocks; clear any drift warnings at the top.'),
  ('/admin', 1, 'Review the overnight summary: new signups, activity, and any platform-health warnings.'),
  ('/admin', 2, 'Note anything unusual and route it to the relevant surface below.'),
  ('/admin/actions', 1, 'Work the queue top to bottom — each item links to where it is resolved.'),
  ('/admin/actions', 2, 'Clear or defer every item so the queue reflects reality, not backlog.'),
  ('/admin/investors', 1, 'Open **Investors** and filter to accreditation status `pending`.'),
  ('/admin/investors', 2, 'Review each submission''s identity + accreditation evidence, then verify or reject with a note.'),
  ('/admin/investors', 3, 'Restricted features stay locked until `kyc_status = verified` — never grant access before verification.'),
  ('/admin/companies', 1, 'Scan for companies stuck at a stage or reporting a blocked onboarding step.'),
  ('/admin/companies', 2, 'Open a company to check its profile, documents, and readiness link.'),
  ('/admin/crm', 1, 'Check **Activity** for replies and new pipeline movement.'),
  ('/admin/crm', 2, 'Advance or note stalled threads under **Pipeline** and **Outreach**.'),
  ('/admin/intro-requests', 1, 'Review requests in `requested` / `reviewing` and facilitate or decline each with a note.'),
  ('/admin/deal-rooms', 1, 'Confirm active rooms have the right documents and access for their phase.'),
  ('/admin/matching', 1, 'Review new match signals and curate the strongest founder ↔ investor pairs.'),
  ('/admin/marketing', 1, 'Check the hub dashboard, then work campaigns, sequences, and the AEO queue as needed.'),
  ('/admin/marketing', 2, 'Keep all copy educational — never imply a securities offer or a fundraising outcome.'),
  ('/admin/events', 1, 'Review presenter applications in `submitted` / `under_review` and decide with the rubric.'),
  ('/admin/events', 2, 'Confirm sponsors and sessions for upcoming events are in order.'),
  ('/admin/compliance', 1, 'Triage new compliance events by severity; resolve or escalate critical flags before end of day.'),
  ('/admin/compliance', 2, 'Confirm the audit trail captured today''s material actions.'),
  ('/admin/readiness', 1, 'Review readiness movement and diligence completeness for companies in an active raise.')
) as s(nav_id, step_no, body) on s.nav_id = m.nav_id
on conflict (module_id, step_no) do nothing;

insert into public.playbook_flag (module_id, kind, label)
select m.id, f.kind, f.label from public.playbook_module m
join (values
  ('/admin/investors', 'hard_gate', 'No restricted access until kyc_status = verified'),
  ('/admin/intro-requests', 'guardrail', 'Facilitate introductions — never share investor PII without consent'),
  ('/admin/deal-rooms', 'guardrail', 'Access is per-phase; confirm before widening'),
  ('/admin/marketing', 'guardrail', 'Educational community content only — not an offer of securities'),
  ('/admin/compliance', 'hard_gate', 'Resolve or escalate critical flags before close')
) as f(nav_id, kind, label) on f.nav_id = m.nav_id;
