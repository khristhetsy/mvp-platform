-- /agreement (the Premium Services Agreement pages) is a top level route, so it cannot be a founder company slug.
insert into public.ir_agent_reserved_slugs (slug) values ('agreement')
on conflict (slug) do nothing;
