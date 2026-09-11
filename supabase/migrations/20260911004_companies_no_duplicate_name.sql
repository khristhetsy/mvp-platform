-- Prevent two identical companies (same founder + same name). A founder may still
-- have multiple DIFFERENTLY-named companies; this only blocks exact duplicates.
--
-- IMPORTANT: run the de-duplication cleanup FIRST (see the review query in the PR /
-- chat). This index creation will FAIL if identical (founder_id, company_name) rows
-- still exist — that failure is the signal that cleanup isn't done yet.

create unique index if not exists companies_founder_name_uniq
  on public.companies (founder_id, lower(company_name))
  where founder_id is not null and company_name is not null;
