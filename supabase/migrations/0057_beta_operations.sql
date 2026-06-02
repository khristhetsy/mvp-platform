-- Private beta operations: feedback queue and staff review.

create table if not exists public.beta_feedback (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('founder', 'investor')),
  category text not null check (
    category in ('bug', 'feature', 'onboarding', 'documents', 'deal_room', 'learning', 'other')
  ),
  severity text not null default 'normal' check (
    severity in ('low', 'normal', 'high', 'critical')
  ),
  message text not null check (char_length(message) >= 3 and char_length(message) <= 4000),
  screenshot_url text,
  status text not null default 'open' check (
    status in ('open', 'reviewing', 'resolved', 'dismissed')
  ),
  admin_notes text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists beta_feedback_status_idx on public.beta_feedback (status, created_at desc);
create index if not exists beta_feedback_profile_idx on public.beta_feedback (profile_id, created_at desc);

alter table public.beta_feedback enable row level security;

drop policy if exists "beta_feedback_select_own" on public.beta_feedback;
create policy "beta_feedback_select_own"
  on public.beta_feedback for select to authenticated
  using (profile_id = auth.uid());

drop policy if exists "beta_feedback_insert_own" on public.beta_feedback;
create policy "beta_feedback_insert_own"
  on public.beta_feedback for insert to authenticated
  with check (profile_id = auth.uid());

drop policy if exists "beta_feedback_select_staff" on public.beta_feedback;
create policy "beta_feedback_select_staff"
  on public.beta_feedback for select to authenticated
  using (public.is_staff());

drop policy if exists "beta_feedback_update_staff" on public.beta_feedback;
create policy "beta_feedback_update_staff"
  on public.beta_feedback for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());
