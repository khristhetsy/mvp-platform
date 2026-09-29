-- Real click tracking for the Social Media Hub. Published post links route through a
-- short /r/<post> redirect that logs the hit here, then 302s to the real destination
-- (still carrying the campaign ?s= tag so /fit attribution is unchanged). Additive.

create table if not exists public.social_clicks (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid references public.social_posts(id) on delete set null,
  campaign_id uuid references public.social_campaigns(id) on delete set null,
  source_tag  text,
  user_agent  text,
  created_at  timestamptz not null default now()
);

create index if not exists social_clicks_tag_idx  on public.social_clicks (source_tag, created_at);
create index if not exists social_clicks_post_idx  on public.social_clicks (post_id);
