-- Pin a session as the Main Stage headline.
--
-- When true, pickMainStageSession() always returns this session for the Main
-- Stage, so another session going live (e.g. a Talk Show on Google Meet) can no
-- longer steal the slot. Only one session per event should carry the flag; the
-- app clears it on siblings when a new one is pinned (see updateSession).

alter table public.sessions
  add column if not exists is_headline boolean not null default false;
