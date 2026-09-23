-- Close public read on vocabulary_options.
--
-- 20260923001 added vocabulary_options_public_read (for all rows, using true)
-- so the signed-out public event registration form could read option lists.
-- That decision is being reversed: option lists are no longer served to
-- anonymous callers. Only staff read and write them, via
-- vocabulary_options_staff_all, which stays in place unchanged.
--
-- Idempotent: drop only if present.

drop policy if exists vocabulary_options_public_read on public.vocabulary_options;
