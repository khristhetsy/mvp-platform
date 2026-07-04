-- Prospect Pipeline — Lead Status (lead-lifecycle workflow stage).
-- Distinct from email_status (deliverability) and segment (hot/warm/cold).
-- Set as you work a prospect; auto-advances from real activity, manual override.

alter table public.crm_contacts
  add column if not exists lead_status text not null default 'new';

-- Constrain to the 7-stage lifecycle.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'crm_contacts_lead_status_check'
  ) then
    alter table public.crm_contacts
      add constraint crm_contacts_lead_status_check
      check (lead_status in ('new','contacted','engaged','qualified','nurturing','converted','disqualified'));
  end if;
end $$;

-- Backfill: anyone already flagged converted starts as 'converted'.
update public.crm_contacts
  set lead_status = 'converted'
  where converted = true and lead_status = 'new';

create index if not exists idx_crm_contacts_lead_status on public.crm_contacts (lead_status);
