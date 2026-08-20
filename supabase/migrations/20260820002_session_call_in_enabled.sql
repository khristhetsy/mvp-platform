-- Per-session "Call-in queue" toggle. When off, the Talk Show hides the call-in
-- column and the video plays full-width. Defaults on (current behaviour).

alter table public.sessions
  add column if not exists call_in_enabled boolean not null default true;

comment on column public.sessions.call_in_enabled is
  'When false, the Talk Show hides the call-in queue and renders the video full-width.';
