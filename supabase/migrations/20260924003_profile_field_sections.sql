-- Profile and fields: separate revenue sections, and per-field version history.
--
-- 1. The shared "revenue_band" list is split into five lists. Each is seeded
--    with exactly the values companies store today, as the stored key (slug),
--    so no answer changes. Labels are free to be reworded from the admin page.
--    revenue_band itself stays in the table (nothing deletes) but is no longer
--    shown or read.
-- 2. profile_field_versions records every save and restore per list, which is
--    what the page's Unsave and version history read.

alter table public.vocabulary_options add column if not exists description text;

insert into public.vocabulary_options (list, slug, label, sort_order, description) values
  ('revenue_size','Pre-revenue','Pre-revenue',10,null),
  ('revenue_size','Under $100k','Under $100k',20,null),
  ('revenue_size','$100k – $500k','$100k – $500k',30,null),
  ('revenue_size','$500k – $1M','$500k – $1M',40,null),
  ('revenue_size','$1M – $5M','$1M – $5M',50,null),
  ('revenue_size','$5M+','$5M+',60,null),

  ('revenue_stage','pre_revenue','Pre-revenue',10,'Idea, prototype, or early development'),
  ('revenue_stage','early_revenue','Early revenue',20,'Up to $100K ARR'),
  ('revenue_stage','growing','Growing',30,'$100K – $1M ARR'),
  ('revenue_stage','scaling','Scaling',40,'$1M+ ARR'),

  ('arr_band','None','None',10,null),
  ('arr_band','Under $100k','Under $100k',20,null),
  ('arr_band','$100k – $500k','$100k – $500k',30,null),
  ('arr_band','$500k – $1M','$500k – $1M',40,null),
  ('arr_band','$1M – $5M','$1M – $5M',50,null),
  ('arr_band','$5M+','$5M+',60,null),

  ('mrr_band','None','None',10,null),
  ('mrr_band','Under $10k','Under $10k',20,null),
  ('mrr_band','$10k – $50k','$10k – $50k',30,null),
  ('mrr_band','$50k – $100k','$50k – $100k',40,null),
  ('mrr_band','$100k+','$100k+',50,null),

  ('money_band','Less than $50k','Less than $50k',10,null),
  ('money_band','$50k - $100k','$50k - $100k',20,null),
  ('money_band','$100k - $250k','$100k - $250k',30,null),
  ('money_band','$250k - $500k','$250k - $500k',40,null),
  ('money_band','$500k - $1m','$500k - $1m',50,null),
  ('money_band','$1m - $10m','$1m - $10m',60,null),
  ('money_band','$10m - $50m','$10m - $50m',70,null),
  ('money_band','$50m - $100m','$50m - $100m',80,null),
  ('money_band','Over $100m','Over $100m',90,null)
on conflict (list, slug) do nothing;

create table if not exists public.profile_field_versions (
  id          uuid primary key default gen_random_uuid(),
  list        text not null,
  version     integer not null,
  snapshot    jsonb not null,
  note        text,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (list, version)
);

create index if not exists profile_field_versions_list_idx
  on public.profile_field_versions (list, version desc);

alter table public.profile_field_versions enable row level security;

drop policy if exists profile_field_versions_staff on public.profile_field_versions;
create policy profile_field_versions_staff on public.profile_field_versions
  for select using (public.is_staff());
