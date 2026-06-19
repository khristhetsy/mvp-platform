alter table public.profiles
  add column if not exists journey_stage text not null default 'initialize'
    check (journey_stage in ('initialize', 'qualify', 'deploy', 'optimize')),
  add column if not exists journey_stage_updated_at timestamptz,
  add column if not exists stage_approval_status text
    check (stage_approval_status in ('pending', 'approved', 'rejected')),
  add column if not exists stage_approval_requested_at timestamptz,
  add column if not exists stage_approved_by uuid references public.profiles(id),
  add column if not exists stage_approved_at timestamptz,
  add column if not exists stage_feedback text;
