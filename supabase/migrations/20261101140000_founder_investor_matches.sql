-- Each founder's best investors, scored once a day against the whole investor network.
--
-- The board and automated outreach used to read ~1,000 investors per request (the database
-- row cap) and rank only those, so every founder was matched against the same arbitrary
-- 14% of the network. A daily job now reads the whole network once, scores every founder
-- with the matching engine, and stores the top ids here. The board and outreach read this
-- list instead and load only those contacts.
--
-- A derived cache: safe to truncate. Readers fall back to the old read when a row is
-- missing, stale, or built from different founder details or engine weights (profile_hash).

create table if not exists public.founder_investor_matches (
  company_id    uuid primary key references public.companies(id) on delete cascade,
  computed_at   timestamptz not null default now(),
  profile_hash  text not null,
  network_size  integer not null,
  matches       jsonb not null default '[]'::jsonb   -- [{ "id": "<crm_contacts id>", "score": 0-100 }], best first
);

-- Only the server (service role) reads or writes this table.
alter table public.founder_investor_matches enable row level security;
