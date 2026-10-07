-- LinkedIn contact profile fill: AI drafted bios, company summaries, labelled guesses,
-- and free person search results, all held for review before anything touches a contact.
-- Additive only.

-- 1. One row per proposed value. Nothing here is read by matching; a value reaches the
--    contact only when someone accepts it (status 'accepted').
create table if not exists public.contact_fill_suggestions (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.crm_contacts(id) on delete cascade,
  field text not null,
  -- text, or a list of labels for multi-value fields
  value jsonb not null,
  -- linkedin = from the LinkedIn export; found = a published source, named in source_url;
  -- guess = worked out from a source, with the reason in basis
  label text not null check (label in ('linkedin', 'found', 'guess')),
  source_url text,
  basis text,
  confidence text,
  origin text not null default 'research',
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references public.profiles(id) on delete set null
);
create unique index if not exists contact_fill_suggestions_pending_uq
  on public.contact_fill_suggestions (contact_id, field) where status = 'pending';
create index if not exists contact_fill_suggestions_pending_idx
  on public.contact_fill_suggestions (created_at, contact_id) where status = 'pending';

-- 2. Company summaries, written once per company and shared by every contact there.
create table if not exists public.company_summaries (
  company_key text primary key,
  company text not null,
  summary text not null,
  website text,
  hq_city text,
  source_url text,
  status text not null default 'draft' check (status in ('draft', 'approved')),
  updated_at timestamptz not null default now(),
  approved_by uuid references public.profiles(id) on delete set null
);

-- 3. When the free person search last looked at a contact, so a batch never repeats one.
alter table public.crm_contacts add column if not exists person_search_at timestamptz;

alter table public.contact_fill_suggestions enable row level security;
alter table public.company_summaries enable row level security;

-- 4. Review queue: contacts with pending suggestions, investors first, then by name.
--    Returns ids only, so the page reads one contact at a time.
create or replace function public.profile_fill_queue(p_group text default 'all')
returns table (contact_id uuid, pending int)
language sql stable security definer set search_path = public as $$
  with q as (
    select s.contact_id, count(*)::int as pending, c.name,
           (c.side = 'investor' or c.raw @> '{"linkedin":{"group":"investor"}}'::jsonb) as is_investor
    from contact_fill_suggestions s
    join crm_contacts c on c.id = s.contact_id
    where s.status = 'pending'
    group by s.contact_id, c.side, c.name, c.raw
  )
  select contact_id, pending from q
  where p_group = 'all' or (p_group = 'investor' and is_investor) or (p_group = 'other' and not coalesce(is_investor, false))
  order by is_investor desc nulls last, name nulls last
$$;
revoke all on function public.profile_fill_queue(text) from public, anon, authenticated;
grant execute on function public.profile_fill_queue(text) to service_role;
