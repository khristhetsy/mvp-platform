-- Tracks the journey stage a founder has acknowledged, so the "stage unlocked"
-- banner shows once per advancement. Additive.

alter table public.user_preferences
  add column if not exists acknowledged_stage text;
