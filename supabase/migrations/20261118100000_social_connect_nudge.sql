-- "Connect with investors" nudge: per founder state for the home banner.
-- social_nudge_dismissals counts closes (the nudge stops at 2); social_nudge_snoozed_until
-- hides it after "Remind me later" or a close. Additive and safe to re-run.

alter table public.user_preferences add column if not exists social_nudge_dismissals integer not null default 0;
alter table public.user_preferences add column if not exists social_nudge_snoozed_until timestamptz;
