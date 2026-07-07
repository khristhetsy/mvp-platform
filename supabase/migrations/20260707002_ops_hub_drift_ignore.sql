-- Operations Hub: let operators permanently dismiss menu-drift surfaces they don't
-- want in the playbook. Seeds the CRM / SPV / Partner surfaces the operator excluded.
alter table public.ops_hub_settings add column if not exists drift_ignored text[] not null default '{}';

update public.ops_hub_settings
  set drift_ignored = array[
    '/admin/crm/founders',
    '/admin/crm/investors',
    '/admin/crm/unclassified',
    '/admin/crm/connectors',
    '/admin/spvs',
    '/admin/partner-scores'
  ]
  where id = 1 and (drift_ignored is null or cardinality(drift_ignored) = 0);
