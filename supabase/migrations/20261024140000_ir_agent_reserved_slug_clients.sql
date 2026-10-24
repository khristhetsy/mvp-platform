-- /clients (client stories page) is a top level route, so it cannot be a founder company slug.
insert into public.ir_agent_reserved_slugs (slug) values ('clients')
on conflict (slug) do nothing;
