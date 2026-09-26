-- Retire the preview-build bridge (20260925210150). Preview deploys fetched a
-- script from dev_scripts and ran it with production secrets, posting output to
-- dev_code_dump. Sessions now reach the repo directly, so the bridge is removed.
drop table if exists public.dev_scripts;
drop table if exists public.dev_code_dump;
