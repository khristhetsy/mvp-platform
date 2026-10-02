-- Deleting a founder cascades to their companies, and two ON DELETE SET NULL paths
-- (actor/investor on profiles, company on companies) then update the same
-- operational_activity_events row in one statement. The second update re-checks
-- company_id against a company that is already gone and the whole user delete fails.
-- Checking this FK at commit, when company_id has been set to null, removes the conflict.
alter table public.operational_activity_events
  alter constraint operational_activity_events_company_id_fkey deferrable initially deferred;
