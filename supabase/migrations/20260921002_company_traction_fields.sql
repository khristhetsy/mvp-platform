-- Traction fields the founder can now answer during onboarding (step 8).
--
-- These four were the only ones on the admin Founder Profile panel with no
-- source anywhere: the founder was never asked, so the panel showed a dash and
-- the CRR engine's Traction and Revenue factors scored zero for want of
-- evidence rather than weak performance.
--
-- Stored as text, not numeric, on purpose: founders write "$240k", "~20,000/mo"
-- or "pre-revenue", and coercing that to a number at write time loses the
-- nuance and rejects honest answers. Matching reads bands, not exact figures.

alter table public.companies
  add column if not exists annual_revenue_size text,
  add column if not exists arr                text,
  add column if not exists mrr                text,
  add column if not exists key_highlights     text;

comment on column public.companies.annual_revenue_size is
  'Last-12-months revenue BAND (Pre-revenue, Under $100k, $100k - $500k, ...). Investor-facing. Distinct from revenue_stage, which describes the company''s phase rather than its revenue.';
comment on column public.companies.arr is
  'Annual recurring revenue, as the founder wrote it. Optional — blank means no recurring revenue, not unknown.';
comment on column public.companies.mrr is
  'Monthly recurring revenue, as the founder wrote it. Optional.';
comment on column public.companies.key_highlights is
  'Up to five one-line highlights, newline-separated. Investor-facing: these become the bullet list on the one-pager.';

-- Revenue band is a filter on the marketplace and in matching.
create index if not exists companies_annual_revenue_size_idx
  on public.companies (annual_revenue_size)
  where annual_revenue_size is not null;
