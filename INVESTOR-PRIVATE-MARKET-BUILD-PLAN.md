# Investor Private Market — Build Plan

A concrete plan to ship the redesigned **Investor Private Market** as a real, data-backed page inside the CapitalOS app. Guiding principle: **show only honest numbers**. Every field on screen is backed by real data, or it isn't shown. The two fields with no backing data today (score trend, "filling fast") are deferred to a fast-follow that adds a snapshot mechanism — until then they're hidden, not faked.

Mockup reference: `capitalos-private-market-investor-refreshed.html`.

---

## Scope

In scope (Phase 1 — real data only):
- Redesigned Investor Private Market page at the existing route `src/app/investor/opportunities/page.tsx`.
- Deal board: symbol, company name, readiness score + band, match score, **fill bar (% indicated + raw $ / target)**, sector.
- Summary strip: matched-deal count, your indicated total (30d), average readiness. (Drop "filling fast" until Phase 3.)
- Theme tokens: add `--teal`, alias existing indigo.

Fast-follow (Phase 3 — needs new data):
- Readiness **score trend** (sparkline + Δ this week).
- **"Filling fast"** velocity metric.
- Both powered by one new readiness/pledge snapshot table + a snapshot pass on the existing cron.

Explicitly out of scope for now:
- Marketing 3-tab redesign (separate, presentation-only effort).
- Multi-tag sectors (today `companies.industry` is a single value — fine for v1).
- Any transaction/pledge-write changes. This is a display surface only.

---

## Phase 0 — Theme tokens (≈30 min)

File: `src/app/globals.css`
- Add `--teal: #0D9488; --teal-hover: #0f766e; --teal-muted: #ecfdf5;`
- Confirm indigo: the mockup's `--indigo (#534AB7)` already exists as `--gold (#534AB7)` / `--gold-muted (#EEEDFB)`. Either (a) add `--indigo`/`--indigo-soft` aliases pointing at the same hex, or (b) use the existing `--gold*` vars in the new components. Recommendation: add `--indigo` aliases so the new code reads clearly and matches the mockup.
- These flow into Tailwind v4 via the existing `@theme inline` block — mirror whatever pattern the current `--blue`/`--navy` tokens use so `bg-[var(--teal-muted)]` etc. work.

Verification: `npm run build` compiles; spot-check a swatch.

---

## Phase 1 — Data layer (≈half day)

All derivations below sit on data that **already exists**. No schema changes.

### 1a. Per-company fill level (% indicated + amounts)
- Source A (totals): `getCompanyPledgeSummaries()` in `src/lib/data/investor-pledges.ts` → RPC `get_companies_pledge_summaries()` returns `total_pledged`, `investor_count`, `currency`.
- Source B (target): `campaigns.funding_target`, fallback `companies.funding_amount` (already formatted in the page as `fundingTarget`).
- New helper: extend the opportunity-row builder to attach `{ totalIndicated, fundingTarget, fillPct = clamp(totalIndicated / fundingTarget, 0..1) }`. Guard divide-by-zero / null target → `fillPct = null` (render "—").

### 1b. Investor's indicated total (30d)
- In `src/app/investor/opportunities/page.tsx`, the existing `investor_interests` query (currently `.not("pledge_amount","is",null)`) gets an added `.gte("pledge_amount_updated_at", thirtyDaysAgo)`, then sum `pledge_amount` across rows for the summary strip.
- Keep the existing full (all-time) pledge map for the per-row "your pledge" badge; the 30d sum is a separate reduce.

### 1c. Average readiness
- Reduce over the matched set's `readinessScore` (already on each row via `loadInvestorRecommendedMatches` → `row.company.readinessScore`), ignoring nulls, `toFixed(1)`.

### 1d. Matched-deal count
- `matches.length` (already available).

Output of Phase 1: the page's `opportunityRows` gain `fillPct`, `totalIndicated`; a new `summary = { matchedCount, indicated30d, avgReadiness }` object is computed server-side and passed to the view.

Verification: unit test the derivations in `src/lib/.../*.test.ts` (Vitest) with mock pledge/target inputs — divide-by-zero, null target, empty set.

---

## Phase 2 — Page + components (≈1–1.5 days)

Reuse the existing page shell and data fetch; swap the presentation.

### Files
- `src/app/investor/opportunities/page.tsx` — keep `requireInvestorWorkspaceSession`, the matches load, and pledge fetch. Add the 30d filter + summary computation (Phase 1). Pass `summary` + enriched rows down.
- New: `src/components/investor/InvestorPrivateMarketBoard.tsx` — the deal board (rows: sigil + symbol/name, readiness price+band, match score, fill bar, sector tags, caret). Server-rendered list; client only if row interactions need it.
- New: `src/components/investor/InvestorPrivateMarketSummary.tsx` — the 4-card strip (render 3 cards in Phase 1; add the 4th "filling fast" in Phase 3).
- Optional: keep `InvestorOpportunitiesModuleViews.tsx` available behind a view toggle, or retire it — decide during build.

### Styling
- Tailwind classes using the Phase 0 tokens; lucide-react icons in place of the mockup's glyph characters (◈ ▲ ◫ → e.g. `TrendingUp`, `Sparkles`, `LayoutGrid`) to match the rest of the app.
- The fill bar = a div with `width: fillPct%`; band thresholds (Strong ≥80 / Moderate ≥70 / Building) as a small helper.
- Compliance notice text copied verbatim from the mockup.

### Trend column in Phase 1
- Render the trend cell as a muted "—" (or omit the column) until Phase 3. No fake sparkline.

Verification: `npx eslint src --quiet` (exit 0) and `npx tsc --noEmit | grep 'error TS' | grep -v test` (empty). Load the page as an investor in local dev; confirm fill %, summary numbers, and match scores match a hand check against the DB.

---

## Phase 3 — Fast follow: trend + "filling fast" (≈1 day, optional/after)

Adds the only genuinely missing data so the sparkline and velocity become real.

### New table (migration `supabase/migrations/00xx_readiness_snapshots.sql`)
- `company_metric_snapshots(company_id, captured_at, readiness_score numeric, total_indicated numeric)` — one row per company per capture. RLS read for staff/matching; written by service role.

### Snapshot pass
- Add a step to the existing cron `GET /api/cron/run-orchestration` (already runs 07:00 & 19:00 UTC per `vercel.json`, guarded by `CRON_SECRET`) that upserts a daily snapshot per active company from `company_readiness_scores.effective_score` and the pledge totals RPC.

### Derivations
- Trend Δ = latest snapshot vs. snapshot ≥7 days ago → drives ▲/▼ + sparkline (build sparkline from the last N snapshots).
- "Filling fast" = `total_indicated` increased by ≥X% (or ≥$Y) over the last 7 days → boolean flag feeding the summary count and an optional row pulse.

Verification: backfill a couple of snapshots manually, confirm Δ math; unit-test the velocity threshold.

---

## Decisions needed before building
1. Retire `InvestorOpportunitiesModuleViews` or keep it as an alternate view?
2. Phase 1 trend column: render "—" placeholder, or hide the column entirely until Phase 3?
3. Do Phase 3 now (so trend/filling-fast ship together) or ship Phase 1–2 first and fast-follow?
4. Indigo: add `--indigo` aliases (recommended) vs. reuse existing `--gold*`?

## Sequencing
Phase 0 → Phase 1 (with tests) → Phase 2 (page + components, verify) → ship. Phase 3 as a separate PR. Each phase is independently shippable; nothing here touches pledge writes or transactions.
