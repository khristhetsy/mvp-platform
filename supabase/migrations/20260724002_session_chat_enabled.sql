-- Per-session attendee chat toggle. When false, the session's live panel shows
-- Q&A only (no free-form chat) — useful for investor-grade sessions where chat
-- adds noise/moderation load. Defaults to true to preserve existing behaviour.

alter table public.sessions
  add column if not exists chat_enabled boolean not null default true;
