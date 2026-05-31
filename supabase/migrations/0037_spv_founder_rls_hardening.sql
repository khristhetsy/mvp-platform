-- Remove founder direct SELECT on SPV tables that contain staff-only notes.
-- Founders use aggregate fields on spv_opportunities (package_readiness_pct, closing_readiness_pct, investor_closing_status).

drop policy if exists "spv_document_packages_select_founder" on public.spv_document_packages;
drop policy if exists "spv_closing_reviews_select_founder" on public.spv_closing_reviews;
