-- The words every form offers, as data instead of code.
--
-- Until now each option list was a hardcoded array: EVENT_SECTORS in
-- lib/icfo-events/sectors.ts, the lists in lib/profile/options.ts, a second
-- copy of the industries inside FounderConversationalOnboarding.tsx. Adding a
-- value meant a code change and a deploy, and the copies were already drifting.
--
-- Same shape as registration_field_sets: the table becomes the source every
-- picker reads, and the constants stay as the fallback for when it is empty or
-- unreachable, so a form can never fail to render.
--
-- NOTHING IS REWRITTEN. The values below are seeded; no existing row is
-- touched. Labels that records already hold but which are not in the new lists
-- are seeded as archived, so they still resolve for display and still match,
-- while not being offered to anyone new.

create table if not exists public.vocabulary_options (
  id          uuid primary key default gen_random_uuid(),
  list        text not null,
  slug        text not null,
  label       text not null,
  sort_order  integer not null default 0,
  archived    boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (list, slug)
);

create index if not exists vocabulary_options_list_idx
  on public.vocabulary_options (list, archived, sort_order);

alter table public.vocabulary_options enable row level security;

drop policy if exists vocabulary_options_staff_all on public.vocabulary_options;
create policy vocabulary_options_staff_all on public.vocabulary_options
  for all using (public.is_staff()) with check (public.is_staff());

-- The public event registration form reads these while signed out. Read-only,
-- and the rows are question options rather than anyone's data.
drop policy if exists vocabulary_options_public_read on public.vocabulary_options;
create policy vocabulary_options_public_read on public.vocabulary_options
  for select using (true);

drop trigger if exists vocabulary_options_touch on public.vocabulary_options;
create trigger vocabulary_options_touch
  before update on public.vocabulary_options
  for each row execute function public.touch_updated_at();

-- ── industry ────────────────────────────────────────────────────────────────

insert into public.vocabulary_options (list, slug, label, sort_order) values
  ('industry','aerospace','Aerospace',10),
  ('industry','agriculture','Agriculture',20),
  ('industry','agtech','AgTech',30),
  ('industry','apparel','Apparel',40),
  ('industry','artificial-intelligence','Artificial Intelligence',50),
  ('industry','biotechnology-life-science','Biotechnology/Life Science',60),
  ('industry','bitcoin','Bitcoin',70),
  ('industry','blockchain','Blockchain',80),
  ('industry','business-services','Business Services',90),
  ('industry','cannabis','Cannabis',100),
  ('industry','cleantech','Cleantech',110),
  ('industry','communications','Communications',120),
  ('industry','computer','Computer',130),
  ('industry','construction','Construction',140),
  ('industry','consumer-products','Consumer Products',150),
  ('industry','cryptocurrency','Cryptocurrency',160),
  ('industry','cyber-security','Cyber Security',170),
  ('industry','data-iot','Data/IoT',180),
  ('industry','deep-tech','Deep Tech',190),
  ('industry','defense','Defense',200),
  ('industry','digital-health','Digital Health',210),
  ('industry','edtech','EdTech',220),
  ('industry','energy','Energy',230),
  ('industry','enterprise-software','Enterprise Software',240),
  ('industry','entertainment','Entertainment',250),
  ('industry','financial-services','Financial Services',260),
  ('industry','fintech','Fintech',270),
  ('industry','food-tech','Food Tech',280),
  ('industry','food-hospitality','Food/Hospitality',290),
  ('industry','gaming','Gaming',300),
  ('industry','hardware','Hardware',310),
  ('industry','health-wellness','Health & Wellness',320),
  ('industry','healthcare','Healthcare',330),
  ('industry','industrial','Industrial',340),
  ('industry','insurance','Insurance',350),
  ('industry','manufacturing','Manufacturing',360),
  ('industry','materials','Materials',370),
  ('industry','media','Media',380),
  ('industry','medical-devices','Medical Devices',390),
  ('industry','mining','Mining',400),
  ('industry','nano-technology','Nano Technology',410),
  ('industry','nuclear-waste-recycling','Nuclear Waste Recycling',420),
  ('industry','oil-gas','Oil & Gas',430),
  ('industry','payment-app','Payment App',440),
  ('industry','plastics','Plastics',450),
  ('industry','professional-services','Professional Services',460),
  ('industry','real-estate','Real Estate',470),
  ('industry','robotics','Robotics',480),
  ('industry','saas','SaaS',490),
  ('industry','semiconductor','Semiconductor',500),
  ('industry','software','Software',510),
  ('industry','telecom','Telecom',520),
  ('industry','transportation','Transportation',530),
  ('industry','travel','Travel',540),
  ('industry','warehousing','Warehousing',550),
  ('industry','other','Other',560)
on conflict (list, slug) do nothing;

-- Labels existing records hold that the new list does not carry. Archived, so
-- they resolve and match but are not offered. They are NOT merged into a
-- similar-looking new value — that is a decision for a person, in the review
-- queue, not one this migration makes.
insert into public.vocabulary_options (list, slug, label, sort_order, archived) values
  ('industry','saas-b2b-software','SaaS / B2B Software',900,true),
  ('industry','healthtech','HealthTech',901,true),
  ('industry','ecommerce','E-commerce',902,true),
  ('industry','ai-ml','AI / ML',903,true),
  ('industry','consumer','Consumer',904,true),
  ('industry','marketplace','Marketplace',905,true),
  ('industry','logistics','Logistics',906,true)
on conflict (list, slug) do nothing;

-- ── funding_stage — the round being raised ──────────────────────────────────

insert into public.vocabulary_options (list, slug, label, sort_order) values
  ('funding_stage','pre-seed','Pre-seed',10),
  ('funding_stage','seed','Seed',20),
  ('funding_stage','series-a','Series A',30),
  ('funding_stage','series-b','Series B',40),
  ('funding_stage','growth','Growth',50),
  ('funding_stage','other','Other',60)
on conflict (list, slug) do nothing;

-- ── operating_stage — the company, not the round ────────────────────────────

insert into public.vocabulary_options (list, slug, label, sort_order) values
  ('operating_stage','startup','Startup',10),
  ('operating_stage','prototype','Prototype',20),
  ('operating_stage','small-business','Small Business',30),
  ('operating_stage','expand-growth','Expand Growth',40),
  ('operating_stage','midsize-company','Midsize Company',50),
  ('operating_stage','large-corporation','Large Corporation',60),
  ('operating_stage','other','Other',70)
on conflict (list, slug) do nothing;

insert into public.vocabulary_options (list, slug, label, sort_order, archived) values
  ('operating_stage','idea','Idea',900,true),
  ('operating_stage','building-mvp','Building / MVP',901,true),
  ('operating_stage','pre-revenue','Pre-revenue',902,true),
  ('operating_stage','revenue','Revenue',903,true),
  ('operating_stage','scaling','Scaling',904,true)
on conflict (list, slug) do nothing;

-- ── investor_type ───────────────────────────────────────────────────────────

insert into public.vocabulary_options (list, slug, label, sort_order) values
  ('investor_type','angel-investor','Angel Investor',10),
  ('investor_type','banker-lender','Banker/Lender',20),
  ('investor_type','debt-and-equity','Both debt and equity investors',30),
  ('investor_type','family-office','Family Office',40),
  ('investor_type','hedge-fund','Hedge Fund',50),
  ('investor_type','investment-bank','Investment Bank',60),
  ('investor_type','lender','Lender',70),
  ('investor_type','pre-series-a','Pre-Series A',80),
  ('investor_type','private-equity','Private Equity',90),
  ('investor_type','represent-investors','Represent Investors',100),
  ('investor_type','venture-capital','Venture Capital',110),
  ('investor_type','other','Other',120)
on conflict (list, slug) do nothing;

insert into public.vocabulary_options (list, slug, label, sort_order, archived) values
  ('investor_type','individual-angel','Individual angel',900,true),
  ('investor_type','angel-group-syndicate','Angel group / syndicate',901,true),
  ('investor_type','venture-fund','Venture fund',902,true),
  ('investor_type','corporate-strategic','Corporate / strategic',903,true)
on conflict (list, slug) do nothing;

-- ── capital_type ────────────────────────────────────────────────────────────

insert into public.vocabulary_options (list, slug, label, sort_order) values
  ('capital_type','alternative-financing','Alternative Financing',10),
  ('capital_type','business-loan','Business Loan',20),
  ('capital_type','debt-capital','Debt Capital',30),
  ('capital_type','equity-capital','Equity Capital',40),
  ('capital_type','human-capital','Human Capital',50),
  ('capital_type','social-capital','Social Capital',60),
  ('capital_type','other','Other',70)
on conflict (list, slug) do nothing;

insert into public.vocabulary_options (list, slug, label, sort_order, archived) values
  ('capital_type','equity','Equity',900,true),
  ('capital_type','safe','SAFE',901,true),
  ('capital_type','convertible-note','Convertible note',902,true),
  ('capital_type','venture-debt','Venture debt',903,true),
  ('capital_type','revenue-based','Revenue-based',904,true)
on conflict (list, slug) do nothing;

-- ── use_of_funds ────────────────────────────────────────────────────────────

insert into public.vocabulary_options (list, slug, label, sort_order) values
  ('use_of_funds','administration','Administration',10),
  ('use_of_funds','balance-sheet-strength','Balance Sheet Strength',20),
  ('use_of_funds','growth-stage','Growth Stage',30),
  ('use_of_funds','lab','Lab',40),
  ('use_of_funds','ma-financing','M&A Financing',50),
  ('use_of_funds','marketing','Marketing',60),
  ('use_of_funds','model','Model',70),
  ('use_of_funds','operation','Operation',80),
  ('use_of_funds','pre-seed-capital','Pre-seed capital',90),
  ('use_of_funds','prototype','Prototype',100),
  ('use_of_funds','recapitalization','Recapitalization',110),
  ('use_of_funds','research-development','Research & Development',120),
  ('use_of_funds','working-capital','WCL — Working Capital',130),
  ('use_of_funds','other','Other',140)
on conflict (list, slug) do nothing;

insert into public.vocabulary_options (list, slug, label, sort_order, archived) values
  ('use_of_funds','hire-team','Hire team',900,true),
  ('use_of_funds','build-product','Build product',901,true),
  ('use_of_funds','marketing-sales','Marketing & sales',902,true),
  ('use_of_funds','rd','R&D',903,true),
  ('use_of_funds','operations','Operations',904,true),
  ('use_of_funds','international-expansion','International expansion',905,true)
on conflict (list, slug) do nothing;

-- ── revenue_band — one set of options, five fields ──────────────────────────
-- Annual revenue size, revenue stage, ARR, MRR and annual EBITDA all offer
-- these. Kept as five separate fields; only the options are shared.

insert into public.vocabulary_options (list, slug, label, sort_order) values
  ('revenue_band','pre-revenue','Pre-revenue',10),
  ('revenue_band','under-100k','Under $100k',20),
  ('revenue_band','100k-500k','$100k – $500k',30),
  ('revenue_band','500k-1m','$500k – $1M',40),
  ('revenue_band','1m-5m','$1M – $5M',50),
  ('revenue_band','5m-plus','$5M+',60)
on conflict (list, slug) do nothing;

insert into public.vocabulary_options (list, slug, label, sort_order, archived) values
  ('revenue_band','none','None',900,true),
  ('revenue_band','under-10k','Under $10k',901,true),
  ('revenue_band','10k-50k','$10k – $50k',902,true),
  ('revenue_band','50k-100k','$50k – $100k',903,true),
  ('revenue_band','100k-plus','$100k+',904,true),
  ('revenue_band','early-revenue','Early revenue',905,true),
  ('revenue_band','growing','Growing',906,true),
  ('revenue_band','scaling','Scaling',907,true),
  ('revenue_band','negative-pre-profit','Negative / pre-profit',908,true),
  ('revenue_band','break-even','Break-even',909,true),
  ('revenue_band','under-250k','Under $250K',910,true),
  ('revenue_band','250k-1m','$250K – $1M',911,true)
on conflict (list, slug) do nothing;

-- ── geography ───────────────────────────────────────────────────────────────

insert into public.vocabulary_options (list, slug, label, sort_order) values
  ('geography','north-america','North America',10),
  ('geography','europe','Europe',20),
  ('geography','latam','LATAM',30),
  ('geography','apac','APAC',40),
  ('geography','mena','MENA',50),
  ('geography','africa','Africa',60),
  ('geography','global','Global',70)
on conflict (list, slug) do nothing;

-- ── business_entity ─────────────────────────────────────────────────────────

insert into public.vocabulary_options (list, slug, label, sort_order) values
  ('business_entity','delaware-c-corp','Delaware C-Corp',10),
  ('business_entity','llc','LLC',20),
  ('business_entity','s-corp','S-Corp',30),
  ('business_entity','public-benefit-corp','Public benefit corp',40),
  ('business_entity','not-yet-incorporated','Not yet incorporated',50)
on conflict (list, slug) do nothing;

-- ── Verify ──────────────────────────────────────────────────────────────────
-- select list, count(*) filter (where not archived) as offered,
--        count(*) filter (where archived) as legacy
-- from public.vocabulary_options group by list order by list;
