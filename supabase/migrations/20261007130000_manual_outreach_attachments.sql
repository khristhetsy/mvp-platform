-- Manual outreach attachments (Outreach → Manual → Send email).
-- What goes with each email: the one pager as a PDF, the one pager link, and
-- PDFs picked from the founder's own data room. New and existing campaigns
-- default to the one pager PDF only.
-- Additive column on an existing table; its RLS (founder_rw_manual_outreach) is unchanged.

alter table public.founder_manual_outreach
  add column if not exists attachments jsonb not null
  default '{"onePagerPdf": true, "onePagerLink": false, "documentIds": []}'::jsonb;
