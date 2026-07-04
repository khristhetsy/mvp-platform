-- Prospect Pipeline — Step 4: segment + hot-queue views. These read the stored
-- pipeline columns the approach worker writes (segment, lead_prescore, approach),
-- so one definition change propagates to CMO, notifications, and Tasks.

create or replace view public.lead_segments as
select
  id,
  side,
  coalesce(segment, 'cold') as computed_segment,
  lead_prescore,
  approach
from public.crm_contacts
where side is not null and approach is not null;

create or replace view public.hot_queue as
select *
from public.crm_contacts
where segment = 'hot'
  and converted = false
  and suppressed = false
order by lead_prescore desc nulls last;
