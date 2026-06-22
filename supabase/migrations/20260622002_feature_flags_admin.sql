-- Allow admin-audience feature flags + new module keys.
-- Drops the original founder/investor + inbox/calendar/scheduling CHECK constraints
-- so the admin operating menu can be governed by Feature Controls. Values are
-- validated server-side (Zod); absence of a row still = enabled.

alter table public.feature_flags drop constraint if exists feature_flags_audience_check;
alter table public.feature_flags drop constraint if exists feature_flags_feature_check;
