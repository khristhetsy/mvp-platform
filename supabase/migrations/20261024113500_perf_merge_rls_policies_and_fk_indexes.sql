-- Behavior-preserving performance migration for mvp-platform (Supabase raowjbhbtmwkycmwvavd).
-- Permissive RLS policies are OR'd, so one merged policy per action is equivalent.
-- is_staff() is wrapped in (select ...) so Postgres evaluates it once per query, not once per row.
-- Baseline row counts to re-check after applying (authenticated role):
--   admin e828bb6f...  profiles 28, companies 20, next_best_actions 309
--   founder ea358709... profiles 1,  companies 1,  next_best_actions 5
--   investor 37470639... profiles 1, companies 19, next_best_actions 1
-- NOT touched on purpose: "Users can insert own profile" (public role, no role check) is broader than
-- profiles_insert_own and lets a user insert their own profile with any role. Review separately.


-- profiles
drop policy if exists "Users can read own profile" on public.profiles;
drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_select_staff on public.profiles;
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_staff()));

drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists profiles_update_own on public.profiles;
drop policy if exists profiles_update_staff on public.profiles;
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid()) or (select public.is_staff()))
  with check (id = (select auth.uid()) or (select public.is_staff()));

-- companies
drop policy if exists companies_select_investor_approved on public.companies;
drop policy if exists companies_select_member on public.companies;
drop policy if exists companies_select_staff on public.companies;
drop policy if exists companies_select on public.companies;
create policy companies_select on public.companies for select to authenticated
  using (
    (select public.is_staff())
    or public.user_belongs_to_company(id)
    or (
      exists (select 1 from public.profiles p where p.id = (select auth.uid()) and lower(p.role) = 'investor')
      and review_status = 'approved' and is_published = true and marketplace_visible = true
      and published_at is not null and is_sample = false
    )
  );

drop policy if exists companies_update_member on public.companies;
drop policy if exists companies_update_staff on public.companies;
drop policy if exists companies_update on public.companies;
create policy companies_update on public.companies for update to authenticated
  using ((select public.is_staff()) or public.user_can_manage_company(id))
  with check ((select public.is_staff()) or public.user_can_manage_company(id));

-- next_best_actions
drop policy if exists next_best_actions_select_own on public.next_best_actions;
drop policy if exists next_best_actions_select_staff on public.next_best_actions;
drop policy if exists next_best_actions_select on public.next_best_actions;
create policy next_best_actions_select on public.next_best_actions for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_staff()));

drop policy if exists next_best_actions_insert_own on public.next_best_actions;
drop policy if exists next_best_actions_insert_staff on public.next_best_actions;
drop policy if exists next_best_actions_insert on public.next_best_actions;
create policy next_best_actions_insert on public.next_best_actions for insert to authenticated
  with check (user_id = (select auth.uid()) or (select public.is_staff()));

drop policy if exists next_best_actions_update_own on public.next_best_actions;
drop policy if exists next_best_actions_update_staff on public.next_best_actions;
drop policy if exists next_best_actions_update on public.next_best_actions;
create policy next_best_actions_update on public.next_best_actions for update to authenticated
  using (user_id = (select auth.uid()) or (select public.is_staff()))
  with check (user_id = (select auth.uid()) or (select public.is_staff()));

-- covering indexes for flagged foreign keys on hot tables
create index if not exists companies_approved_by_idx on public.companies (approved_by);
create index if not exists companies_figures_attested_by_idx on public.companies (figures_attested_by);
create index if not exists companies_offering_type_attested_by_idx on public.companies (offering_type_attested_by);
create index if not exists cron_schedule_overrides_updated_by_idx on public.cron_schedule_overrides (updated_by);
create index if not exists platform_settings_updated_by_idx on public.platform_settings (updated_by);
create index if not exists profiles_stage_approved_by_idx on public.profiles (stage_approved_by);

