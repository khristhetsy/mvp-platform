-- Business plan AI charts — structured allocation + market figures for auto-generated graphs.
-- { allocation: [{label, pct}], market: { tam, sam, som } }
alter table public.business_plans add column if not exists charts jsonb not null default '{}'::jsonb;
