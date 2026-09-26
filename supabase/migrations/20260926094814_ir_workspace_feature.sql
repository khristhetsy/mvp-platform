-- Register the IR workspace (/admin/ir: dashboard, projects, tasks, Odoo import) as
-- its own feature in the Investor Relations hub. The sidebar's "Investor Relations
-- Hub" links to /admin/ir, but only /admin/playbook was registered, so
-- department-scoped IR staff were bounced to the dashboard. Grant it to every
-- department that already has the Investor Relations Hub (operations_hub) enabled.

insert into public.features (key, label, hub_key, path, sort_order)
values ('ir_workspace', 'IR Projects & Tasks', 'investor_relations', '/admin/ir', 2)
on conflict (key) do nothing;

insert into public.department_features (department_id, feature_id, enabled)
select df.department_id, f_new.id, true
from public.department_features df
join public.features f_hub on f_hub.id = df.feature_id and f_hub.key = 'operations_hub'
join public.features f_new on f_new.key = 'ir_workspace'
where df.enabled = true
on conflict (department_id, feature_id) do nothing;
