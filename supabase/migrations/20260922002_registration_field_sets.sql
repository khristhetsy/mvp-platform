-- Event registration questions become data instead of code constants.
--
-- Until now the three arrays in lib/icfo-events/registration-fields.ts were the
-- only definition, shared by the public registration form and the admin
-- "Register a guest" form so the two could never drift. That sharing is worth
-- keeping — this table becomes the one source they both read, and the constants
-- stay as the fallback for when the table is empty or unreachable, so the form
-- can never fail to render.
--
-- Same shape as crr_weight_sets and pricing_sets: one active row, every save
-- appends, nothing edited in place.

create table if not exists public.registration_field_sets (
  id          uuid primary key default gen_random_uuid(),
  version     text not null unique,              -- 'reg-fields-v2'
  roles       jsonb not null,                    -- [{key,label}] — the attendee-type tabs
  common      jsonb not null,                    -- [{key,label,kind,options?,required?}]
  by_type     jsonb not null,                    -- { investor: [...], founder: [...], ... }
  is_active   boolean not null default false,
  reason      text,                              -- why this version exists (required in the UI)
  created_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now()
);

-- Exactly one active set, the same guard the other versioned config tables use.
create unique index if not exists registration_field_sets_one_active
  on public.registration_field_sets ((is_active)) where is_active;
create index if not exists registration_field_sets_created_idx
  on public.registration_field_sets (created_at desc);

alter table public.registration_field_sets enable row level security;

drop policy if exists registration_field_sets_staff_all on public.registration_field_sets;
create policy registration_field_sets_staff_all on public.registration_field_sets
  for all using (public.is_staff()) with check (public.is_staff());

-- The public registration form needs to read the active set while signed out.
-- Read-only, and the row holds question definitions rather than anyone's data.
drop policy if exists registration_field_sets_public_read on public.registration_field_sets;
create policy registration_field_sets_public_read on public.registration_field_sets
  for select using (is_active);

-- Seed: exactly today's constants, so nothing moves until someone saves.
insert into public.registration_field_sets (version, roles, common, by_type, is_active, reason, created_by)
select
  'reg-fields-v1',
  '[
    {"key":"investor","label":"Investor"},
    {"key":"founder","label":"Founder"},
    {"key":"service","label":"Service Provider"},
    {"key":"sponsor","label":"Sponsor"}
  ]'::jsonb,
  '[
    {"key":"name","label":"Full name","kind":"text","required":true},
    {"key":"company","label":"Company / firm","kind":"text","required":true},
    {"key":"title","label":"Title","kind":"text","required":true},
    {"key":"country","label":"Country","kind":"select","required":true,"optionsFrom":"countries"},
    {"key":"email","label":"Email","kind":"text","required":true},
    {"key":"phone","label":"Phone number","kind":"text","required":true}
  ]'::jsonb,
  '{
    "investor":[
      {"key":"investorType","label":"Investor type","kind":"select","required":true,
       "options":["Angel","Venture Capital","Private Equity","Family Office","LP","Syndicate"]},
      {"key":"checkSize","label":"Typical check size","kind":"select","required":true,
       "options":["< $25k","$25k–$100k","$100k–$500k","$500k–$2M","$2M+"]},
      {"key":"stages","label":"Stage focus","kind":"chips","required":true,
       "options":["Pre-seed","Seed","Series A","Series B+"]},
      {"key":"sectors","label":"Sectors of interest","kind":"chips","required":true,"optionsFrom":"sectors"},
      {"key":"thesis","label":"Investment thesis / what you look for","kind":"textarea","required":true},
      {"key":"accredited","label":"I am an accredited investor","kind":"checkbox"}
    ],
    "founder":[
      {"key":"stage","label":"Company stage","kind":"select","required":true,
       "options":["Idea","Pre-seed","Seed","Series A","Series B+"]},
      {"key":"sector","label":"Sector","kind":"select","required":true,"optionsFrom":"sectors"},
      {"key":"raising","label":"Currently raising?","kind":"select","required":true,
       "options":["Not raising","Raising now","In 3–6 months"]},
      {"key":"roundSize","label":"Round size","kind":"select","required":true,
       "options":["< $250k","$250k–$1M","$1M–$3M","$3M+"]},
      {"key":"lookingFor","label":"Looking for","kind":"chips","required":true,
       "options":["Capital","Investor intros","Mentorship","Partners","Hiring"]},
      {"key":"pitch","label":"One-line pitch","kind":"textarea","required":true},
      {"key":"applyToPresent","label":"Apply to present at the showcase","kind":"checkbox"}
    ],
    "service":[
      {"key":"serviceCategory","label":"Service category","kind":"select","required":true,
       "options":["Legal","Banking","Accounting","Consulting","Marketing","Tech / Tools"]},
      {"key":"whoYouServe","label":"Who you serve","kind":"select","required":true,
       "options":["Founders","Investors","Both"]},
      {"key":"specialty","label":"Specialty / offer","kind":"textarea","required":true},
      {"key":"interestedIn","label":"Interested in","kind":"chips","required":true,
       "options":["Just attending","A booth","Sponsorship","Speaking"]}
    ],
    "sponsor":[
      {"key":"tier","label":"Tier interest","kind":"select","required":true,
       "options":["Presenting","Gold","Silver","Community","Not sure"]},
      {"key":"budget","label":"Budget range","kind":"select","required":true,
       "options":["< $5k","$5k–$15k","$15k–$40k","$40k+"]},
      {"key":"goals","label":"Goals","kind":"chips","required":true,
       "options":["Lead generation","Brand awareness","Recruiting","Thought leadership"]},
      {"key":"timeline","label":"Decision timeline","kind":"select","required":true,
       "options":["This week","This month","Exploring"]},
      {"key":"notes","label":"Anything we should know?","kind":"textarea","required":true}
    ]
  }'::jsonb,
  true,
  'Seeded from the code constants that shipped with the registration intake.',
  null
where not exists (select 1 from public.registration_field_sets);

comment on table public.registration_field_sets is
  'Versioned event-registration questions. One active row; saves append. The code constants in lib/icfo-events/registration-fields.ts remain the fallback when this table is empty or unreachable.';
comment on column public.registration_field_sets.by_type is
  'Per-attendee-type questions. A field with optionsFrom ("sectors"/"countries") takes its options from the shared list at read time rather than copying them, so the two can never diverge.';
