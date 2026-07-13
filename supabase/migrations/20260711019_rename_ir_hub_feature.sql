-- Feature Controls label fix: the /admin/playbook feature is the Investor Relations
-- Hub in the sidebar, but the department feature registry still labels it "Operations
-- Hub". Rename the display label to match (key and path unchanged).

update public.features
set label = 'Investor Relations Hub'
where key = 'operations_hub' and path = '/admin/playbook';
