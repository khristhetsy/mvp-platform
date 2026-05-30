-- Phase 1 controlled founder–investor messaging and meeting requests.

create table if not exists public.message_threads (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  founder_id uuid not null references public.profiles(id) on delete cascade,
  investor_id uuid not null references public.profiles(id) on delete cascade,
  intro_request_id uuid references public.intro_requests(id) on delete set null,
  status text not null default 'requested' check (
    status in ('requested', 'active', 'closed', 'archived')
  ),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists message_threads_open_pair_idx
  on public.message_threads (company_id, investor_id)
  where status in ('requested', 'active');

create index if not exists message_threads_founder_id_idx on public.message_threads (founder_id);
create index if not exists message_threads_investor_id_idx on public.message_threads (investor_id);
create index if not exists message_threads_company_id_idx on public.message_threads (company_id);
create index if not exists message_threads_updated_at_idx on public.message_threads (updated_at desc);

create table if not exists public.thread_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.message_threads(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  message_type text not null default 'user_message' check (
    message_type in (
      'user_message',
      'system_note',
      'intro_request',
      'follow_up',
      'meeting_request',
      'meeting_scheduled'
    )
  ),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists thread_messages_thread_id_idx on public.thread_messages (thread_id, created_at asc);
create index if not exists thread_messages_sender_id_idx on public.thread_messages (sender_id);

create table if not exists public.thread_meetings (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.message_threads(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  founder_id uuid not null references public.profiles(id) on delete cascade,
  investor_id uuid not null references public.profiles(id) on delete cascade,
  requested_by uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'proposed' check (
    status in ('proposed', 'accepted', 'declined', 'canceled', 'scheduled')
  ),
  proposed_start_time timestamptz,
  proposed_end_time timestamptz,
  timezone text,
  meeting_title text,
  meeting_notes text,
  external_calendar_provider text,
  external_calendar_event_id text,
  external_meet_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists thread_meetings_thread_id_idx on public.thread_meetings (thread_id);
create index if not exists thread_meetings_status_idx on public.thread_meetings (status);

alter table public.message_threads enable row level security;
alter table public.thread_messages enable row level security;
alter table public.thread_meetings enable row level security;

-- message_threads
drop policy if exists "message_threads_select_founder" on public.message_threads;
create policy "message_threads_select_founder"
  on public.message_threads for select to authenticated
  using (founder_id = auth.uid());

drop policy if exists "message_threads_select_investor" on public.message_threads;
create policy "message_threads_select_investor"
  on public.message_threads for select to authenticated
  using (investor_id = auth.uid() and public.is_investor());

drop policy if exists "message_threads_select_staff" on public.message_threads;
create policy "message_threads_select_staff"
  on public.message_threads for select to authenticated
  using (public.is_staff());

-- thread_messages (participant via thread)
drop policy if exists "thread_messages_select_founder" on public.thread_messages;
create policy "thread_messages_select_founder"
  on public.thread_messages for select to authenticated
  using (
    exists (
      select 1 from public.message_threads t
      where t.id = thread_id and t.founder_id = auth.uid()
    )
  );

drop policy if exists "thread_messages_select_investor" on public.thread_messages;
create policy "thread_messages_select_investor"
  on public.thread_messages for select to authenticated
  using (
    exists (
      select 1 from public.message_threads t
      where t.id = thread_id and t.investor_id = auth.uid() and public.is_investor()
    )
  );

drop policy if exists "thread_messages_select_staff" on public.thread_messages;
create policy "thread_messages_select_staff"
  on public.thread_messages for select to authenticated
  using (public.is_staff());

-- thread_meetings
drop policy if exists "thread_meetings_select_founder" on public.thread_meetings;
create policy "thread_meetings_select_founder"
  on public.thread_meetings for select to authenticated
  using (founder_id = auth.uid());

drop policy if exists "thread_meetings_select_investor" on public.thread_meetings;
create policy "thread_meetings_select_investor"
  on public.thread_meetings for select to authenticated
  using (investor_id = auth.uid() and public.is_investor());

drop policy if exists "thread_meetings_select_staff" on public.thread_meetings;
create policy "thread_meetings_select_staff"
  on public.thread_meetings for select to authenticated
  using (public.is_staff());

-- Extend CRM activity types for messaging events.
alter table public.investor_activity drop constraint if exists investor_activity_activity_type_check;

alter table public.investor_activity add constraint investor_activity_activity_type_check check (
  activity_type in (
    'saved_deal',
    'expressed_interest',
    'requested_intro',
    'follow_up_requested',
    'pledge_amount_submitted',
    'message_thread_created',
    'message_sent',
    'meeting_requested',
    'meeting_accepted',
    'meeting_declined'
  )
);
