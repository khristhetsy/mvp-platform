-- Investor sign up (/investors/start) records who the lead is and their
-- mandate answers. role: 'founder' | 'investor'. details: investor type, check
-- size and sectors (jsonb), used to prefill investor onboarding later.
alter table public.marketing_site_leads
  add column if not exists role text check (role in ('founder', 'investor')),
  add column if not exists details jsonb;
