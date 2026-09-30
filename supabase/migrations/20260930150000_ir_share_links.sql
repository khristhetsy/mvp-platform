-- IR email share links: a term sheet or a company data room, sent to investors from the
-- task Matching tab's email dialog. Each link carries an unguessable token, the investor
-- emails it was sent to, an optional expiry and a revoke stamp. The public /dr/<token>
-- page lets in only those emails (read from the per-recipient {{email}} merge tag) while
-- the link is live, and every open and file view is logged in ir_share_views and as an
-- activity on the investor's match. Additive and idempotent.

create table if not exists public.ir_share_links (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  project_id uuid not null references public.ir_projects(id) on delete cascade,
  company_id uuid references public.companies(id) on delete set null,
  kind text not null check (kind in ('data_room', 'term_sheet')),
  document_id uuid references public.documents(id) on delete set null,
  file_path text,
  file_name text,
  recipients text[] not null default '{}',
  expires_at timestamptz,
  revoked_at timestamptz,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists ir_share_links_project_idx on public.ir_share_links (project_id);

create table if not exists public.ir_share_views (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references public.ir_share_links(id) on delete cascade,
  email text not null,
  match_id uuid references public.ir_matches(id) on delete set null,
  document_id uuid,
  action text not null check (action in ('open', 'view')),
  viewed_at timestamptz not null default now()
);
create index if not exists ir_share_views_link_idx on public.ir_share_views (link_id, email);

-- Staff read and write through the app's service role; the same staff policy as the other ir_ tables.
do $$
declare t text;
begin
  foreach t in array array['ir_share_links', 'ir_share_views'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_staff_all', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.is_staff()) with check (public.is_staff())', t || '_staff_all', t);
  end loop;
end $$;
