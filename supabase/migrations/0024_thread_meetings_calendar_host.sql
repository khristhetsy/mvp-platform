-- Track which user connected Google account owns the Calendar event (acceptor at schedule time).

alter table public.thread_meetings
  add column if not exists calendar_host_user_id uuid references public.profiles(id) on delete set null;

create index if not exists thread_meetings_calendar_host_user_id_idx
  on public.thread_meetings (calendar_host_user_id)
  where calendar_host_user_id is not null;
