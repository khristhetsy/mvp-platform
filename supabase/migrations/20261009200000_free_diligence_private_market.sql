-- Free due diligence, Private Market listing, report sharing, partner codes and
-- Premium by wire (approved Oct 9, 2026).
--
-- Additive only: new nullable columns, new tables, and one widened check. No
-- existing row changes meaning. Every new table has RLS on with explicit
-- policies. Staff = public.is_staff() (admin or analyst).

-- ─── 1. Listing checklist on the company ─────────────────────────────────────
-- A founder is listed in the investor Private Market when all four checks pass:
-- documents uploaded, diligence report complete (both derived), figures
-- attested and listing opt in (stored here). Any CRR qualifies.
alter table public.companies
  add column if not exists figures_attested_at timestamptz,
  add column if not exists figures_attested_by uuid references public.profiles(id) on delete set null,
  add column if not exists listing_opt_in_at timestamptz,
  -- First moment all four checks passed; set once by the app, drives deal notices.
  add column if not exists listing_completed_at timestamptz,
  -- Partner code used at claim or signup (attribution only).
  add column if not exists partner_code text;

create index if not exists companies_listing_completed_idx
  on public.companies (listing_completed_at)
  where listing_completed_at is not null;

-- ─── 2. Investor interest on a free founder expires ──────────────────────────
-- Requests from investors to a founder who has not upgraded expire after 14
-- days. Null = never expires (every existing row).
alter table public.intro_requests
  add column if not exists expires_at timestamptz;

-- ─── 3. Diligence report share links ─────────────────────────────────────────
create table if not exists public.diligence_report_shares (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  token text not null unique,
  label text,
  revoked_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists diligence_report_shares_company_idx on public.diligence_report_shares (company_id);

create table if not exists public.diligence_report_share_views (
  id uuid primary key default gen_random_uuid(),
  share_id uuid not null references public.diligence_report_shares(id) on delete cascade,
  action text not null default 'view' check (action in ('view', 'download')),
  viewed_at timestamptz not null default now()
);
create index if not exists diligence_report_share_views_share_idx on public.diligence_report_share_views (share_id, viewed_at desc);

alter table public.diligence_report_shares enable row level security;
alter table public.diligence_report_share_views enable row level security;

drop policy if exists "founder_own_report_shares" on public.diligence_report_shares;
create policy "founder_own_report_shares" on public.diligence_report_shares
  for all
  using (exists (select 1 from public.companies c where c.id = company_id and c.founder_id = auth.uid()) or public.is_staff())
  with check (exists (select 1 from public.companies c where c.id = company_id and c.founder_id = auth.uid()) or public.is_staff());

drop policy if exists "founder_own_report_share_views" on public.diligence_report_share_views;
create policy "founder_own_report_share_views" on public.diligence_report_share_views
  for select
  using (
    exists (
      select 1 from public.diligence_report_shares s
      join public.companies c on c.id = s.company_id
      where s.id = share_id and (c.founder_id = auth.uid() or public.is_staff())
    )
  );
-- Views are written by the public share page through the service role only.

-- ─── 4. Partner codes ────────────────────────────────────────────────────────
create table if not exists public.partner_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = upper(code) and code ~ '^[A-Z0-9]{3,20}$'),
  partner_name text not null,
  crm_contact_id uuid references public.crm_contacts(id) on delete set null,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.partner_codes enable row level security;
drop policy if exists "staff_all_partner_codes" on public.partner_codes;
create policy "staff_all_partner_codes" on public.partner_codes
  for all using (public.is_staff()) with check (public.is_staff());
-- Public claim and signup pages validate codes through the service role.

-- ─── 5. Lead claims (free report claimed from the lead email) ────────────────
create table if not exists public.lead_claims (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  crm_contact_id uuid references public.crm_contacts(id) on delete set null,
  profile_id uuid references public.profiles(id) on delete set null,
  company_id uuid references public.companies(id) on delete set null,
  partner_code text,
  claimed_at timestamptz not null default now()
);
create index if not exists lead_claims_email_idx on public.lead_claims (lower(email));
create index if not exists lead_claims_partner_idx on public.lead_claims (partner_code) where partner_code is not null;

alter table public.lead_claims enable row level security;
drop policy if exists "staff_read_lead_claims" on public.lead_claims;
create policy "staff_read_lead_claims" on public.lead_claims
  for select using (public.is_staff());
-- Written by the claim route through the service role only.

-- ─── 6. Deal notices to matched investors ────────────────────────────────────
-- One row per (listed company, matched investor contact). Queued when the
-- company first completes its listing checklist; staff send them from
-- Marketing > Deal notices. The token is the investor's opt in link.
create table if not exists public.listing_deal_notices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  crm_contact_id uuid not null references public.crm_contacts(id) on delete cascade,
  match_score integer,
  status text not null default 'queued' check (status in ('queued', 'sent', 'skipped', 'failed')),
  token text not null unique,
  error text,
  sent_at timestamptz,
  viewed_at timestamptz,
  opted_in_at timestamptz,
  investor_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (company_id, crm_contact_id)
);
create index if not exists listing_deal_notices_status_idx on public.listing_deal_notices (status, created_at);
create index if not exists listing_deal_notices_company_idx on public.listing_deal_notices (company_id);

alter table public.listing_deal_notices enable row level security;
drop policy if exists "staff_all_listing_deal_notices" on public.listing_deal_notices;
create policy "staff_all_listing_deal_notices" on public.listing_deal_notices
  for all using (public.is_staff()) with check (public.is_staff());
drop policy if exists "founder_read_own_deal_notices" on public.listing_deal_notices;
create policy "founder_read_own_deal_notices" on public.listing_deal_notices
  for select using (exists (select 1 from public.companies c where c.id = company_id and c.founder_id = auth.uid()));

-- ─── 7. Premium by wire ──────────────────────────────────────────────────────
create sequence if not exists public.wire_invoice_seq start 1;

create table if not exists public.wire_invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  company_id uuid references public.companies(id) on delete set null,
  plan_type text not null default 'founder_premium',
  billing_cycle text not null check (billing_cycle in ('monthly', 'quarterly')),
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'USD',
  status text not null default 'awaiting' check (status in ('awaiting', 'received', 'overdue', 'void')),
  issued_at timestamptz not null default now(),
  due_at timestamptz not null,
  period_start timestamptz,
  period_end timestamptz,
  received_at timestamptz,
  received_by uuid references public.profiles(id) on delete set null,
  reminder_sent_at timestamptz,
  is_renewal boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists wire_invoices_profile_idx on public.wire_invoices (profile_id, issued_at desc);
create index if not exists wire_invoices_status_idx on public.wire_invoices (status, due_at);

alter table public.wire_invoices enable row level security;
drop policy if exists "founder_read_own_wire_invoices" on public.wire_invoices;
create policy "founder_read_own_wire_invoices" on public.wire_invoices
  for select using (profile_id = auth.uid() or public.is_staff());
drop policy if exists "staff_write_wire_invoices" on public.wire_invoices;
create policy "staff_write_wire_invoices" on public.wire_invoices
  for all using (public.is_staff()) with check (public.is_staff());
-- Founders request invoices through an API route that writes with the service role.

create or replace function public.next_wire_invoice_number()
returns text
language sql
security definer
set search_path = public
as $$
  select 'INV ' || to_char(now() at time zone 'America/Los_Angeles', 'YYYY') || ' ' ||
         lpad(nextval('public.wire_invoice_seq')::text, 4, '0');
$$;
revoke all on function public.next_wire_invoice_number() from public, anon, authenticated;

-- ─── 8. The two founder lead emails, in Marketing > Campaigns > Templates ────
insert into public.marketing_templates (name, subject, preview_text, status, html_body)
select v.name, v.subject, v.preview_text, 'active', h.html_body
from (values
  (
    'Free due diligence: existing relationships',
    'Your FREE due diligence report, no cost, no obligation',
    'A one time, completely FREE AI due diligence report and Capital Readiness Rating',
    'We value our relationship with you. As a thank you, we''d like to give your company a one time, <strong>completely FREE</strong> full AI due diligence report and Capital Readiness Rating.'
  ),
  (
    'Free due diligence: new leads',
    'Your FREE due diligence report, no cost, no obligation',
    'A one time, completely FREE AI due diligence report and Capital Readiness Rating',
    'We want to earn your business. That''s why we''d like to give your company a one time, <strong>completely FREE</strong> full AI due diligence report and Capital Readiness Rating.'
  )
) as v(name, subject, preview_text, opening)
cross join lateral (
  select
    '<div style="font-family:Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;color:#16223F;line-height:1.65;font-size:15px;">'
    || '<p style="margin:0 0 14px;"><span style="display:inline-block;background:#E7F5EC;color:#1F6B3A;font-weight:bold;font-size:13px;padding:5px 12px;border-radius:6px;">100% FREE · No credit card · No obligation</span></p>'
    || '<p>Hi {{first_name}},</p>'
    || '<p>' || v.opening || '</p>'
    || '<p style="margin:18px 0 6px;font-weight:bold;">What you get, free</p>'
    || '<ul style="padding-left:18px;margin:0 0 14px;">'
    || '<li>A full due diligence report, the kind investors run before they invest</li>'
    || '<li>Your Capital Readiness Rating, with clear steps to raise it</li>'
    || '<li>Once complete, a listing in our Private Market for our network of 7,000+ investors</li>'
    || '</ul>'
    || '<div style="background:#F4F6FA;border-radius:8px;padding:12px 14px;margin:0 0 16px;">'
    || '<p style="margin:0 0 4px;font-weight:bold;">Your data is secure and private</p>'
    || '<p style="margin:0;font-size:13px;color:#4A5570;">Your documents are encrypted and stored privately. Investors see only your listing summary. Your documents stay private until you choose to share them, and we never sell your data.</p>'
    || '</div>'
    || '<p>It takes about 15 minutes. No cost, no credit card, no obligation.</p>'
    || '<p style="margin:20px 0;"><a href="{{claim_url}}" style="display:inline-block;background:#1A6CE4;color:#ffffff;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:bold;">Claim my FREE report</a></p>'
    || '<p>Best regards,<br>Khris Thetsy<br><span style="color:#4A5570;">Founder and CEO, iCFO Capital Global, Inc.</span></p>'
    || '<p style="margin-top:24px;font-size:11px;color:#8A93A8;">iCFO Capital does not solicit securities and is not an investment adviser. Content is for educational purposes only. Listing does not guarantee investor interest or funding.</p>'
    || '</div>' as html_body
) h
where not exists (select 1 from public.marketing_templates t where t.name = v.name);
