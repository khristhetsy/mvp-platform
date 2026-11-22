-- Pin search_path on phone_to_e164 (Supabase advisor: function_search_path_mutable).
-- The function only uses built-in functions and operators, which always resolve from
-- pg_catalog, so an empty search_path cannot change its behavior.
alter function public.phone_to_e164(text) set search_path = '';
