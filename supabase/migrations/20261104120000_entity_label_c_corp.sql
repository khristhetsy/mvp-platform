-- "Delaware C-Corp" is now just "C-Corp" in the Business entity list.
-- The slug stays, so nothing that references it breaks. Records that stored the
-- old label are moved to the new one so they still match the list.
update public.vocabulary_options
   set label = 'C-Corp', updated_at = now()
 where list = 'business_entity' and slug = 'delaware-c-corp';

update public.companies
   set business_entity = 'C-Corp'
 where business_entity = 'Delaware C-Corp';
