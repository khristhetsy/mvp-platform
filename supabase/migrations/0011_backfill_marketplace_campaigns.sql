-- Backfill campaigns for approved, published companies missing a campaign row.

insert into public.campaigns (
  company_id,
  title,
  slug,
  problem,
  solution,
  market_opportunity,
  traction,
  funding_target,
  use_of_funds,
  risk_disclosures,
  status,
  published_at
)
select
  c.id,
  c.company_name,
  coalesce(
    c.slug,
    trim(both '-' from regexp_replace(lower(c.company_name), '[^a-z0-9]+', '-', 'g'))
  ) || case
    when exists (
      select 1
      from public.campaigns existing
      where existing.slug = coalesce(
        c.slug,
        trim(both '-' from regexp_replace(lower(c.company_name), '[^a-z0-9]+', '-', 'g'))
      )
    ) then '-' || left(replace(c.id::text, '-', ''), 8)
    else ''
  end,
  c.business_description,
  c.business_description,
  c.industry,
  c.revenue_stage,
  c.funding_amount,
  c.use_of_funds,
  'This opportunity is for informational purposes only and does not constitute an offer to sell securities.',
  'published',
  coalesce(c.published_at, c.approved_at, now())
from public.companies c
where c.review_status = 'approved'
  and c.is_published = true
  and c.marketplace_visible = true
  and c.published_at is not null
  and not exists (
    select 1 from public.campaigns cam where cam.company_id = c.id
  );

-- Sync campaign slug/status for existing rows tied to live marketplace companies
update public.campaigns cam
set
  slug = coalesce(c.slug, cam.slug),
  status = 'published',
  published_at = coalesce(c.published_at, cam.published_at, now()),
  title = coalesce(cam.title, c.company_name),
  problem = coalesce(cam.problem, c.business_description),
  solution = coalesce(cam.solution, c.business_description),
  market_opportunity = coalesce(cam.market_opportunity, c.industry),
  traction = coalesce(cam.traction, c.revenue_stage),
  funding_target = coalesce(cam.funding_target, c.funding_amount),
  use_of_funds = coalesce(cam.use_of_funds, c.use_of_funds)
from public.companies c
where cam.company_id = c.id
  and c.review_status = 'approved'
  and c.is_published = true
  and c.marketplace_visible = true
  and c.published_at is not null;
