-- Audit fix (Supabase advisor 0011): pin search_path on functions that had a
-- role-mutable one. Applied as ALTER only, function bodies are unchanged.
alter function public.contact_filter_facets set search_path = public, extensions;
alter function public.contact_role set search_path = public, extensions;
alter function public.investor_profile_canon set search_path = public, extensions;
alter function public.contact_industries_override set search_path = public, extensions;
alter function public.contact_in_sales_pipeline set search_path = public, extensions;
alter function public.search_contact_id_array set search_path = public, extensions;
alter function public.person_name_key set search_path = public, extensions;
alter function public.phone_key set search_path = public, extensions;
alter function public.phone_to_e164 set search_path = public, extensions;
alter function public.phone_to_e164_v2 set search_path = public, extensions;
