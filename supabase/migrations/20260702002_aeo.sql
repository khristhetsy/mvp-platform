-- AEO (Answer Engine Optimization) foundation.
-- Public pillar pages engineered to be citable by AI, authored from the marketing
-- hub. Table stays admin-gated (writes); the render layer reads published rows
-- server-side and serves them publicly.

create table if not exists public.aeo_pages (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  status text not null default 'draft' check (status in ('draft','in_review','published')),
  eyebrow text,
  h1 text not null,
  lede text,
  definition_answer text not null,
  defined_term text,
  sections jsonb not null default '[]',
  faq jsonb not null default '[]',
  meta_description text,
  compliance_status text not null default 'unreviewed'
    check (compliance_status in ('unreviewed','cleared','flagged')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists aeo_pages_status_idx on public.aeo_pages (status);

-- Audit of publish/unpublish/compliance actions (human accountability).
create table if not exists public.aeo_publish_log (
  id uuid primary key default gen_random_uuid(),
  page_id uuid references public.aeo_pages(id) on delete cascade,
  action text not null check (action in ('published','unpublished','compliance_cleared','compliance_flagged')),
  admin_id uuid not null references public.profiles(id) on delete cascade,
  detail text,
  created_at timestamptz not null default now()
);
create index if not exists aeo_publish_log_page_idx on public.aeo_publish_log (page_id, created_at desc);

-- Pre-publish exposure gate (§1 fix-first blockers). Singleton row. Both flags
-- default FALSE so publish is BLOCKED until an admin confirms each is resolved.
create table if not exists public.aeo_settings (
  id boolean primary key default true check (id),   -- singleton guard
  deal_names_masked boolean not null default false,     -- real portfolio names off public deal cards
  security_page_noindexed boolean not null default false, -- draft /security not publicly indexable
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
insert into public.aeo_settings (id) values (true) on conflict (id) do nothing;

-- RLS: writes admin-only; the render layer reads published rows via service role.
alter table public.aeo_pages       enable row level security;
alter table public.aeo_publish_log enable row level security;
alter table public.aeo_settings    enable row level security;

-- Authenticated staff read (published + drafts visible in the hub); the public
-- render path uses the service-role client, so no anon policy is needed here.
drop policy if exists "aeo_pages_staff_read" on public.aeo_pages;
create policy "aeo_pages_staff_read" on public.aeo_pages
  for select to authenticated using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','analyst'))
  );

drop policy if exists "aeo_log_staff_read" on public.aeo_publish_log;
create policy "aeo_log_staff_read" on public.aeo_publish_log
  for select to authenticated using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','analyst'))
  );

drop policy if exists "aeo_settings_staff_read" on public.aeo_settings;
create policy "aeo_settings_staff_read" on public.aeo_settings
  for select to authenticated using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','analyst'))
  );

-- Seed the Capital Readiness pillar as a DRAFT (engagement-register language).
-- It is NOT published — publishing still requires passing both gates in §6.
insert into public.aeo_pages (slug, status, eyebrow, h1, lede, definition_answer, defined_term, sections, faq, meta_description, compliance_status)
values (
  'capital-readiness-rating',
  'draft',
  'Capital readiness',
  'What is a Capital Readiness Rating?',
  'A structured way to describe how prepared a company is to engage with institutional capital.',
  'A Capital Readiness Rating is a structured assessment that describes how prepared a company is to engage with investors, across areas like corporate governance, financial documentation, data-room completeness, and disclosure hygiene. It is a descriptive readiness signal — a way to see where a company stands and what to organize next — not a prediction of any fundraising outcome or a recommendation to invest.',
  'Capital Readiness Rating',
  '[
    {"id":"what-it-measures","heading":"What a Capital Readiness Rating describes","body":"A Capital Readiness Rating looks at the artifacts and practices investors typically review during diligence: an organized data room, current financial statements, a clean cap table, corporate governance records, and clear disclosures. It reflects how complete and well-organized those materials are at a point in time."},
    {"id":"how-it-is-built","heading":"How the rating is assembled","body":"The rating is assembled from observable inputs — which documents exist, whether they are current, and how the pieces fit together. Because it is driven by evidence rather than opinion, two reviewers looking at the same materials would arrive at a similar picture."},
    {"id":"what-it-is-not","heading":"What it is not","body":"A readiness rating is not investment advice, not a valuation, and not a forecast that capital will be raised. It describes preparation and organization; decisions about any investment rest entirely with investors and their own diligence."}
  ]'::jsonb,
  '[
    {"q":"Is a Capital Readiness Rating a prediction that a company will raise money?","a":"No. It is a descriptive measure of how organized and complete a company''s diligence materials are. It does not predict fundraising outcomes."},
    {"q":"Who is a Capital Readiness Rating for?","a":"It helps founders see how prepared their materials are and helps them organize what investors typically expect to review."},
    {"q":"Does a rating mean a company is a good investment?","a":"No. It describes readiness and organization only. Any investment decision is made independently by investors based on their own diligence."}
  ]'::jsonb,
  'A Capital Readiness Rating is a structured, evidence-based description of how prepared a company is to engage with institutional capital — governance, financials, data room, and disclosures.',
  'unreviewed'
) on conflict (slug) do nothing;
