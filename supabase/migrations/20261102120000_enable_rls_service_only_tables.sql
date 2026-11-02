-- Enable row level security on tables that shipped without it.
-- All four are accessed only through the service role client in app code
-- (verified in src/), so no anon or authenticated policies are needed.
-- With RLS on and no policies, PostgREST access via the public anon key is denied.

do $$
declare
  t text;
begin
  foreach t in array array['data_room_access', 'investor_enrichment', 'formd_firms', 'social_settings']
  loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security', t);
      execute format('revoke all on public.%I from anon, authenticated', t);
    end if;
  end loop;
end $$;
