-- Amount of capital and Annual EBITDA become selections (2026-09-24).
--
-- Both use the nine money bands already present in the Odoo contact records
-- ("Investor investment size?", "Investor preferences for company with annual
-- EBITDA range of?", "Entrepreneur annual EBITDA?"). No new options are created.
--
-- funding_amount (numeric) stays: about 90 files read it as an exact figure
-- (valuation, cap table, round health, pitch deck, business plan). The band is
-- stored next to it, and a trigger keeps the two consistent for every writer:
--   * exact amount written, band untouched  -> band follows the amount
--   * band written, amount outside the band -> amount cleared (it would contradict
--     the band); an amount inside the band is kept
-- Keep public.money_band_for() in step with moneyBandFor() in
-- src/lib/profile/options.ts.

alter table public.companies
  add column if not exists funding_amount_band text;

comment on column public.companies.funding_amount_band is
  'Amount of capital the founder is raising, as one of the nine contact-record money bands. Kept consistent with funding_amount by trg_companies_funding_band.';

-- Band for an exact amount. Boundary values go to the higher band; anything
-- below $50k (including zero and negatives) is the lowest band.
create or replace function public.money_band_for(amount numeric)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when amount is null then null
    when amount >= 100000000 then 'Over $100m'
    when amount >= 50000000  then '$50m - $100m'
    when amount >= 10000000  then '$10m - $50m'
    when amount >= 1000000   then '$1m - $10m'
    when amount >= 500000    then '$500k - $1m'
    when amount >= 250000    then '$250k - $500k'
    when amount >= 100000    then '$100k - $250k'
    when amount >= 50000     then '$50k - $100k'
    else 'Less than $50k'
  end;
$$;

create or replace function public.companies_sync_funding_band()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.funding_amount_band = '' then
    new.funding_amount_band := null;
  end if;

  if tg_op = 'INSERT' then
    if new.funding_amount_band is null and new.funding_amount is not null then
      new.funding_amount_band := public.money_band_for(new.funding_amount);
    elsif new.funding_amount is not null
      and public.money_band_for(new.funding_amount) is distinct from new.funding_amount_band then
      new.funding_amount := null;
    end if;
    return new;
  end if;

  -- UPDATE: exact amount changed, band left alone -> band follows the amount.
  if new.funding_amount is distinct from old.funding_amount
     and new.funding_amount_band is not distinct from old.funding_amount_band then
    if new.funding_amount is not null then
      new.funding_amount_band := public.money_band_for(new.funding_amount);
    end if;
  -- Band changed -> drop an exact amount that falls outside it.
  elsif new.funding_amount_band is distinct from old.funding_amount_band then
    if new.funding_amount is not null
       and public.money_band_for(new.funding_amount) is distinct from new.funding_amount_band then
      new.funding_amount := null;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_companies_funding_band on public.companies;
create trigger trg_companies_funding_band
  before insert or update of funding_amount, funding_amount_band on public.companies
  for each row execute function public.companies_sync_funding_band();

-- Backfill: every existing exact amount gets its band (amount is kept, since it
-- sits inside its own band).
update public.companies
set funding_amount_band = public.money_band_for(funding_amount)
where funding_amount is not null
  and funding_amount_band is null;

-- Annual EBITDA: convert existing free text to a band where it is a plain
-- number ("0", "20,000", "-891686"); clear anything else (projections, prose).
-- Values already equal to a band label are left as they are.
update public.companies
set annual_ebitda = case
  when annual_ebitda in ('Less than $50k', '$50k - $100k', '$100k - $250k', '$250k - $500k',
                         '$500k - $1m', '$1m - $10m', '$10m - $50m', '$50m - $100m', 'Over $100m')
    then annual_ebitda
  when regexp_replace(annual_ebitda, '[\s,$]', '', 'g') ~ '^-?[0-9]+(\.[0-9]+)?$'
    then public.money_band_for(regexp_replace(annual_ebitda, '[\s,$]', '', 'g')::numeric)
  else null
end
where annual_ebitda is not null;

-- Empty strings become null so "not answered" has one representation.
update public.companies set annual_ebitda = null where annual_ebitda = '';
