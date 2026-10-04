-- LinkedIn connections import + website enrichment (Contacts ⚙ → Import LinkedIn connections).
--
-- 1. Match keys on crm_contacts so a connection already in Contacts is found by an index,
--    never by scanning raw: linkedin_slug (new column), person_name_key(name), phone_key(phone).
-- 2. Backfill linkedin_slug from LinkedIn profile URLs already stored on contacts
--    (Odoo kept them in the website field or in the record body). One pass, run once.
-- 3. Functions the import and enrichment routes call (service role only).

create or replace function public.person_name_key(t text) returns text
language sql immutable parallel safe as $$
  select nullif(btrim(regexp_replace(lower(coalesce(t, '')), '[^a-z0-9]+', ' ', 'g')), '')
$$;

create or replace function public.phone_key(t text) returns text
language sql immutable parallel safe as $$
  select case when length(regexp_replace(coalesce(t, ''), '\D', '', 'g')) >= 9
              then right(regexp_replace(t, '\D', '', 'g'), 9) end
$$;

alter table public.crm_contacts add column if not exists linkedin_slug text;

create index if not exists crm_contacts_linkedin_slug_idx on public.crm_contacts (linkedin_slug) where linkedin_slug is not null;
create index if not exists crm_contacts_name_key_idx on public.crm_contacts (public.person_name_key(name)) where name is not null;
create index if not exists crm_contacts_phone_key_idx on public.crm_contacts (public.phone_key(phone)) where phone is not null;

update public.crm_contacts
set linkedin_slug = lower(substring(coalesce(website, '') || ' ' || coalesce(raw::text, '') || ' ' || coalesce(profile::text, '')
                                    from 'linkedin\.com/in/([A-Za-z0-9_%-]+)'))
where linkedin_slug is null
  and (website ilike '%linkedin.com/in/%' or raw::text ilike '%linkedin.com/in/%' or profile::text ilike '%linkedin.com/in/%');

-- Every contact that could be the same person as each connection.
-- p_rows: [{ "i": 0, "slug": "ana-ruiz", "email": "ana@x.com", "name": "Ana Ruiz" }, …]
create or replace function public.linkedin_import_match(p_rows jsonb)
returns table (idx int, kind text, contact_id uuid, contact_name text, contact_company text)
language sql stable security definer set search_path = public as $$
  with r as (
    select (e->>'i')::int as i,
           nullif(lower(e->>'slug'), '') as slug,
           nullif(lower(btrim(e->>'email')), '') as email,
           person_name_key(e->>'name') as nk
    from jsonb_array_elements(p_rows) e
  )
  select r.i, m.kind, m.id, m.name, m.company
  from r
  cross join lateral (
    (select 'linkedin'::text as kind, c.id, c.name, c.company from crm_contacts c
      where r.slug is not null and c.linkedin_slug = r.slug limit 3)
    union all
    (select 'email', c.id, c.name, c.company from crm_contacts c
      where r.email is not null and lower(c.email) = r.email limit 3)
    union all
    (select 'name', c.id, c.name, c.company from crm_contacts c
      where r.nk is not null and c.name is not null and person_name_key(c.name) = r.nk limit 5)
  ) m
$$;

-- Fill blanks on existing contacts from their LinkedIn connection; never overwrites a value.
-- p_rows: [{ "id": uuid, "slug", "email", "company", "position", "li": {…} }, …]
create or replace function public.linkedin_import_merge(p_rows jsonb)
returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update crm_contacts c set
    linkedin_slug = coalesce(c.linkedin_slug, x.slug),
    email = coalesce(nullif(c.email, ''), x.email),
    email_source = case when nullif(c.email, '') is null and x.email is not null then 'given' else c.email_source end,
    company = coalesce(nullif(c.company, ''), x.company),
    raw = coalesce(c.raw, '{}'::jsonb)
          || jsonb_build_object('linkedin', x.li)
          || case when coalesce(c.raw->>'function', '') = '' and x.position is not null
                  then jsonb_build_object('function', x.position) else '{}'::jsonb end
  from (
    select (e->>'id')::uuid as id,
           nullif(lower(e->>'slug'), '') as slug,
           nullif(lower(btrim(e->>'email')), '') as email,
           nullif(btrim(e->>'company'), '') as company,
           nullif(btrim(e->>'position'), '') as position,
           coalesce(e->'li', '{}'::jsonb) as li
    from jsonb_array_elements(p_rows) e
  ) x
  where c.id = x.id;
  get diagnostics n = row_count;
  return n;
end $$;

-- How much of a group is left to enrich. p_group: investor | founder | other | all
create or replace function public.linkedin_enrich_stats(p_group text)
returns table (contacts bigint, companies bigint, pending_contacts bigint, pending_companies bigint)
language sql stable security definer set search_path = public as $$
  with l as (
    select enrichment_status, lower(btrim(company)) as co from crm_contacts
    where source = 'linkedin'
      and (p_group = 'all' or raw @> jsonb_build_object('linkedin', jsonb_build_object('group', p_group)))
  )
  select count(*),
         count(distinct co),
         count(*) filter (where enrichment_status = 'pending'),
         count(distinct co) filter (where enrichment_status = 'pending')
  from l
$$;

-- The next companies to enrich in a group, with their pending LinkedIn contacts.
create or replace function public.linkedin_enrich_next(p_group text, p_limit int)
returns table (id uuid, name text, company text, email text, phone text, first_name text, last_name text, company_domain text, website text)
language sql stable security definer set search_path = public as $$
  with pending as (
    select c.* from crm_contacts c
    where c.source = 'linkedin' and c.enrichment_status = 'pending'
      and (p_group = 'all' or c.raw @> jsonb_build_object('linkedin', jsonb_build_object('group', p_group)))
  ),
  cos as (
    select lower(btrim(coalesce(company, ''))) as co from pending
    group by 1 order by 1 limit greatest(1, least(p_limit, 200))
  )
  select p.id, p.name, p.company, p.email, p.phone,
         p.raw->'linkedin'->>'first_name', p.raw->'linkedin'->>'last_name',
         p.company_domain, p.website
  from pending p join cos on cos.co = lower(btrim(coalesce(p.company, '')))
$$;

-- A website already known for each company name, from contacts outside this import.
create or replace function public.linkedin_known_domains(p_companies text[])
returns table (company text, domain text)
language sql stable security definer set search_path = public as $$
  select q.co, d.domain
  from unnest(p_companies) as q(co)
  cross join lateral (
    select coalesce(nullif(c.company_domain, ''), nullif(c.website, '')) as domain
    from crm_contacts c
    where c.company ilike replace(replace(replace(q.co, '\', '\\'), '%', '\%'), '_', '\_')
      and c.source <> 'linkedin'
      and coalesce(nullif(c.company_domain, ''), nullif(c.website, '')) is not null
      and coalesce(c.website, '') not ilike '%linkedin.com%'
    limit 1
  ) d
$$;

-- Who already holds a phone or an email found on a website.
create or replace function public.linkedin_enrich_lookup(p_phones text[], p_emails text[])
returns table (kind text, key text, contact_id uuid, contact_name text, contact_company text, source text)
language sql stable security definer set search_path = public as $$
  select 'phone', phone_key(c.phone), c.id, c.name, c.company, c.source
  from crm_contacts c where phone_key(c.phone) = any (select phone_key(p) from unnest(p_phones) p) and c.phone is not null
  union all
  select 'email', lower(c.email), c.id, c.name, c.company, c.source
  from crm_contacts c where lower(c.email) = any (select lower(e) from unnest(p_emails) e)
$$;

revoke all on function public.linkedin_import_match(jsonb) from public, anon, authenticated;
revoke all on function public.linkedin_import_merge(jsonb) from public, anon, authenticated;
revoke all on function public.linkedin_enrich_stats(text) from public, anon, authenticated;
revoke all on function public.linkedin_enrich_next(text, int) from public, anon, authenticated;
revoke all on function public.linkedin_known_domains(text[]) from public, anon, authenticated;
revoke all on function public.linkedin_enrich_lookup(text[], text[]) from public, anon, authenticated;
grant execute on function public.linkedin_import_match(jsonb) to service_role;
grant execute on function public.linkedin_import_merge(jsonb) to service_role;
grant execute on function public.linkedin_enrich_stats(text) to service_role;
grant execute on function public.linkedin_enrich_next(text, int) to service_role;
grant execute on function public.linkedin_known_domains(text[]) to service_role;
grant execute on function public.linkedin_enrich_lookup(text[], text[]) to service_role;
