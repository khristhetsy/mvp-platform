-- Register the moved "Outreach Qualification" page as its own feature in the
-- Investor Relations hub. The page moved from /admin/matching/outreach (covered
-- by the /admin/matching grant) to the standalone /admin/outreach-qualification,
-- so department-scoped staff were bounced to the dashboard. Add the feature and
-- grant it to every department that already has Matching enabled (same audience).

insert into public.features (key, label, hub_key, path, sort_order)
values ('outreach_qualification', 'Outreach Qualification', 'investor_relations', '/admin/outreach-qualification', 95)
on conflict (key) do nothing;

insert into public.department_features (department_id, feature_id, enabled)
select df.department_id, f_new.id, true
from public.department_features df
join public.features f_match on f_match.id = df.feature_id and f_match.key = 'matching'
join public.features f_new on f_new.key = 'outreach_qualification'
where df.enabled = true
on conflict (department_id, feature_id) do nothing;
