-- Wire capital type, active rating and check size for Odoo-imported prospects.
-- The import used to drop these; this adds the two missing columns and backfills
-- every existing prospect from its Odoo contact (prospect_investors.source_ref =
-- crm_contacts.id). Mirrors src/lib/matching/odoo-mandate.ts; change both together.
-- Check sizes are only filled where still empty, so staff edits are kept.

alter table public.prospect_investors
  add column if not exists capital_types text[] not null default '{}',
  add column if not exists active_rating smallint check (active_rating between 1 and 5);

with src as (
  select
    p.id,
    c.raw->'__profile' as prof
  from public.prospect_investors p
  join public.crm_contacts c on c.id::text = p.source_ref
  where p.source = 'investor_crm' and c.module = 'investor'
),
sizes as (
  select s.id,
    min(b.lo) as lo,
    case when bool_or(b.hi is null) then null else max(b.hi) end as hi
  from src s
  cross join lateral jsonb_array_elements_text(
    case jsonb_typeof(s.prof->'extra'->'Investor investment size?')
      when 'array' then s.prof->'extra'->'Investor investment size?'
      when 'string' then jsonb_build_array(s.prof->'extra'->>'Investor investment size?')
      else '[]'::jsonb end
  ) v(label)
  join (values
    ('Less than $50k', 0::numeric, 50000::numeric),
    ('$50k - $100k', 50000, 100000),
    ('$100k - $250k', 100000, 250000),
    ('$250k - $500k', 250000, 500000),
    ('$500k - $1m', 500000, 1000000),
    ('$1m - $10m', 1000000, 10000000),
    ('$10m - $50m', 10000000, 50000000),
    ('$50m - $100m', 50000000, 100000000),
    ('Over $100m', 100000000, null)
  ) b(label, lo, hi) on b.label = v.label
  group by s.id
),
capital as (
  select s.id,
    array_agg(distinct m.platform order by m.platform) as types
  from src s
  cross join lateral jsonb_array_elements_text(
    case jsonb_typeof(s.prof->'capital') when 'array' then s.prof->'capital' else '[]'::jsonb end
  ) v(label)
  join (values
    ('Equity Capital', 'Equity'),
    ('Debt Capital', 'Venture debt'),
    ('Business Loan', 'Venture debt'),
    ('Alternative Financing', 'Revenue-based')
  ) m(odoo, platform) on m.odoo = v.label
  group by s.id
),
rating as (
  select s.id,
    (substring(
      case jsonb_typeof(s.prof->'extra'->'Active investor')
        when 'array' then s.prof->'extra'->'Active investor'->>0
        else s.prof->'extra'->>'Active investor' end
      from '^([1-5])-'))::smallint as r
  from src s
)
update public.prospect_investors p set
  capital_types  = coalesce(capital.types, p.capital_types),
  active_rating  = coalesce(rating.r, p.active_rating),
  check_size_min = coalesce(p.check_size_min, sizes.lo),
  check_size_max = case when p.check_size_min is null and p.check_size_max is null then sizes.hi else p.check_size_max end,
  updated_at     = now()
from src
left join sizes   on sizes.id = src.id
left join capital on capital.id = src.id
left join rating  on rating.id = src.id
where p.id = src.id;
