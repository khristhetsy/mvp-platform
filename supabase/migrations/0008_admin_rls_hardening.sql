-- Harden admin/staff RLS for review actions and audit logging.

alter table public.admin_reviews enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists "audit_logs_insert_staff" on public.audit_logs;
create policy "audit_logs_insert_staff"
  on public.audit_logs for insert to authenticated
  with check (public.is_staff());

drop policy if exists "audit_logs_select_staff" on public.audit_logs;
create policy "audit_logs_select_staff"
  on public.audit_logs for select to authenticated
  using (public.is_staff());

drop policy if exists "documents_update_staff" on public.documents;
create policy "documents_update_staff"
  on public.documents for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists "profiles_update_staff" on public.profiles;
create policy "profiles_update_staff"
  on public.profiles for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());
