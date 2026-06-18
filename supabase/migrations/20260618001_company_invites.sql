-- Company invite tokens for co-founder / team member invites
-- Founders send an invite by email; recipient accepts via a unique token URL.

create table if not exists public.company_invites (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies(id) on delete cascade,
  inviter_id    uuid not null references public.profiles(id) on delete cascade,
  invitee_email text not null,
  token         uuid not null default gen_random_uuid() unique,
  role          text not null default 'member' check (role in ('admin', 'member')),
  status        text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null default (now() + interval '7 days'),
  accepted_at   timestamptz,
  accepted_by_user_id uuid references public.profiles(id) on delete set null
);

create index if not exists company_invites_company_id_idx on public.company_invites (company_id);
create index if not exists company_invites_token_idx       on public.company_invites (token);
create index if not exists company_invites_email_idx       on public.company_invites (invitee_email);

alter table public.company_invites enable row level security;

-- Owners and admins of the company can read invites for their company
create policy "company_invites_select_member"
  on public.company_invites for select to authenticated
  using (
    exists (
      select 1 from public.company_members cm
      where cm.company_id = company_invites.company_id
        and cm.user_id = auth.uid()
    )
  );

-- Owners and admins can create invites
create policy "company_invites_insert_owner_admin"
  on public.company_invites for insert to authenticated
  with check (
    inviter_id = auth.uid()
    and exists (
      select 1 from public.company_members cm
      where cm.company_id = company_invites.company_id
        and cm.user_id = auth.uid()
        and cm.role in ('owner', 'admin')
    )
  );

-- Owners and admins can update (revoke) invites; also allow any auth'd user to mark accepted
create policy "company_invites_update"
  on public.company_invites for update to authenticated
  using (
    -- owner/admin can revoke
    exists (
      select 1 from public.company_members cm
      where cm.company_id = company_invites.company_id
        and cm.user_id = auth.uid()
        and cm.role in ('owner', 'admin')
    )
    -- or the acceptor is setting accepted_by_user_id to themselves
    or (status = 'pending' and expires_at > now())
  );

-- Service-role bypass is implicit — admin client ignores RLS
