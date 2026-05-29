-- Aggregate investor pledge totals per company (service role / security definer only).

create or replace function public.get_companies_pledge_summaries(p_company_ids uuid[])
returns table (
  company_id uuid,
  total_pledged numeric,
  investor_count integer,
  currency text
)
language sql
stable
security definer
set search_path = public
as $$
  with scoped as (
    select
      coalesce(ii.company_id, c.company_id) as company_id,
      ii.investor_id,
      ii.pledge_amount,
      ii.pledge_currency
    from public.investor_interests ii
    left join public.campaigns c on c.id = ii.campaign_id
    where coalesce(ii.company_id, c.company_id) = any (p_company_ids)
      and ii.pledge_amount is not null
      and ii.pledge_amount > 0
  )
  select
    s.company_id,
    coalesce(sum(s.pledge_amount), 0)::numeric as total_pledged,
    count(distinct s.investor_id)::integer as investor_count,
    coalesce(max(s.pledge_currency), 'USD') as currency
  from scoped s
  group by s.company_id;
$$;

revoke all on function public.get_companies_pledge_summaries(uuid[]) from public;
grant execute on function public.get_companies_pledge_summaries(uuid[]) to service_role;
