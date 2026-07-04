-- Prospect Pipeline — Step 2: contact_sides view. Single source of truth for a
-- contact's resolved side, so downstream modules (approach, publish, CMO) read
-- one place. Rows with side is null surface in the Classify review queue.

create or replace view public.contact_sides as
select
  id,
  side               as resolved_side,   -- null = unclassified (review queue)
  side_confidence,
  module,
  company,
  company_domain,
  email
from public.crm_contacts;
