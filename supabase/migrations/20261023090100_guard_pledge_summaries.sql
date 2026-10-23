-- Audit fix: get_companies_pledge_summaries is called with the signed-in user's
-- client (founder pages, /deals), so it cannot be revoked. Instead it now only
-- returns companies the caller may see: service role, staff, members of the
-- company, or investors viewing an approved company.
create or replace function public.get_companies_pledge_summaries(p_company_ids uuid[])
returns table(company_id uuid, total_pledged numeric, investor_count integer, currency text)
language sql
stable
security definer
set search_path to 'public', 'extensions'
as $function$
  with scoped as (
    select coalesce(ii.company_id, c.company_id) as company_id,
           ii.investor_id, ii.pledge_amount, ii.pledge_currency
    from public.investor_interests ii
    left join public.campaigns c on c.id = ii.campaign_id
    where coalesce(ii.company_id, c.company_id) = any (p_company_ids)
      and ii.pledge_amount is not null
      and ii.pledge_amount > 0
      and (
        coalesce(auth.role(), '') in ('service_role', '')
        or public.is_staff()
        or public.user_belongs_to_company(coalesce(ii.company_id, c.company_id))
        or (public.is_investor() and public.company_is_approved(coalesce(ii.company_id, c.company_id)))
      )
  )
  select s.company_id,
         coalesce(sum(s.pledge_amount), 0)::numeric as total_pledged,
         count(distinct s.investor_id)::integer as investor_count,
         coalesce(max(s.pledge_currency), 'USD') as currency
  from scoped s
  group by s.company_id;
$function$;
