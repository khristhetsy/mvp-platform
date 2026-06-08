-- Launch hardening: block privilege escalation, tighten investor document access.

-- Only founder/investor may be assigned at signup (auth trigger).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text;
  safe_role text;
begin
  requested_role := lower(coalesce(new.raw_user_meta_data->>'role', 'founder'));
  safe_role := case
    when requested_role in ('founder', 'investor') then requested_role
    else 'founder'
  end;

  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    safe_role
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, profiles.full_name);

  return new;
end;
$$;

-- Prevent self-service profile role changes (staff may assign roles via service role).
create or replace function public.profiles_guard_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if not public.is_staff() and lower(coalesce(new.role, '')) not in ('founder', 'investor') then
      new.role := 'founder';
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' and not public.is_staff() and new.role is distinct from old.role then
    new.role := old.role;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_guard_role_escalation on public.profiles;
create trigger profiles_guard_role_escalation
  before insert or update on public.profiles
  for each row execute function public.profiles_guard_role_escalation();

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert to authenticated
  with check (
    id = auth.uid()
    and lower(role) in ('founder', 'investor')
  );

-- Investors cannot self-approve or mutate staff-only review fields.
create or replace function public.investor_profiles_guard_approval_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_staff() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.approval_status := 'draft';
    new.admin_feedback := null;
    new.submitted_at := null;
    new.approved_at := null;
    new.approved_by := null;
    return new;
  end if;

  if new.approval_status in ('approved', 'rejected', 'changes_requested') then
    new.approval_status := old.approval_status;
  elsif new.approval_status = 'submitted'
    and old.approval_status not in ('draft', 'rejected', 'changes_requested') then
    new.approval_status := old.approval_status;
  end if;

  new.approved_at := old.approved_at;
  new.approved_by := old.approved_by;

  if new.approval_status = 'submitted' and old.approval_status in ('draft', 'rejected', 'changes_requested') then
    new.submitted_at := coalesce(new.submitted_at, now());
  elsif new.approval_status is distinct from old.approval_status then
    new.submitted_at := old.submitted_at;
    new.admin_feedback := old.admin_feedback;
  elsif new.approval_status <> 'submitted' then
    new.admin_feedback := old.admin_feedback;
  end if;

  return new;
end;
$$;

drop trigger if exists investor_profiles_guard_approval_fields on public.investor_profiles;
create trigger investor_profiles_guard_approval_fields
  before insert or update on public.investor_profiles
  for each row execute function public.investor_profiles_guard_approval_fields();

-- Relationship-based investor access to company documents (approved companies only).
create or replace function public.investor_has_company_document_access(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1
      from public.profiles p
      join public.investor_profiles ip on ip.profile_id = p.id
      where p.id = auth.uid()
        and lower(p.role) = 'investor'
        and ip.approval_status = 'approved'
    )
    and public.company_is_approved(target_company_id)
    and (
      exists (
        select 1 from public.saved_deals sd
        where sd.investor_id = auth.uid() and sd.company_id = target_company_id
      )
      or exists (
        select 1 from public.intro_requests ir
        where ir.investor_id = auth.uid() and ir.company_id = target_company_id
      )
      or exists (
        select 1 from public.investor_interests ii
        where ii.investor_id = auth.uid() and ii.company_id = target_company_id
      )
      or exists (
        select 1 from public.deal_rooms dr
        where dr.investor_user_id = auth.uid() and dr.company_id = target_company_id
      )
      or exists (
        select 1 from public.spv_participations sp
        where sp.investor_id = auth.uid() and sp.company_id = target_company_id
      )
    );
$$;

drop policy if exists "documents_select_investor_approved" on public.documents;
drop policy if exists "documents_select_investor_related" on public.documents;
create policy "documents_select_investor_related"
  on public.documents for select to authenticated
  using (
    coalesce(document_type, '') <> 'SPV_REQUIREMENT'
    and public.investor_has_company_document_access(company_id)
  );
