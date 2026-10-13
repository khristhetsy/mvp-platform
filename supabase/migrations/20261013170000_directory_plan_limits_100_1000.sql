-- One investor limit per founder plan, counting every source (directory,
-- Form D, LinkedIn, CSV or Excel, added by hand; iCFO introductions excluded):
-- Basic up to 100, Professional up to 1,000, Premium up to 10,000 (were 500,
-- 10,000 and 20,000). Email caps and Free are unchanged. Top ups are retired in
-- code; granted top up rows are left in place but no longer read. Founders
-- already above a new limit keep their contacts and can't add more until under it.
update public.investor_directory_plan_allowances set contacts = 100,   updated_at = now() where plan_type = 'founder_basic';
update public.investor_directory_plan_allowances set contacts = 1000,  updated_at = now() where plan_type = 'founder_professional';
update public.investor_directory_plan_allowances set contacts = 10000, updated_at = now() where plan_type = 'founder_premium';
