# Codebase Audit — mvp-platform

_Full read-only review across correctness, security, performance, maintainability, and best practices. No code was changed. Findings are ordered Critical → Low; each carries file:line, impact, and a specific fix._

## Overall posture

The codebase is in genuinely good shape. Auth is centralized in a small set of well-written helpers, 219 of 221 tables have RLS, webhooks verify signatures, Next.js 16 footguns (awaited `params`/`searchParams`, `.single()` vs `.maybeSingle()`, server/client boundaries) are handled correctly almost everywhere, and there is virtually no debug debris (0 `console.log`, 3 TODOs). The real risks are a narrow set of self-guarding surfaces (two tables missing RLS, an unauthenticated webhook), one founder-facing N+1 that won't scale, a scoring-weight bug, and accumulated type-safety / duplication friction that slows future work rather than breaking today.

---

## CRITICAL

### C1 · Two public tables ship without RLS — PII readable via the public anon key
**Security · `supabase/migrations/20260704006_publish.sql`** — `publish_items` (L5), `publish_events` (L23)
Of 221 tables, only these two never `enable row level security` and have no policies. `publish_events` stores `email` and `contact_id`. Any table without RLS in the public schema is readable/writable by the `anon` and `authenticated` roles through PostgREST using `NEXT_PUBLIC_SUPABASE_ANON_KEY` — which ships to every browser.
**Impact:** Anyone can `GET /rest/v1/publish_events?select=*` to exfiltrate contact emails and marketing engagement, or insert/delete rows. App code only touches these via service role, so the exposure is purely the missing RLS.
**Fix:** New migration: `alter table public.publish_events enable row level security;` (+ `publish_items`), no `anon`/`authenticated` policies, and `revoke all on public.publish_events, public.publish_items from anon, authenticated;`.

### C2 · Unbounded N+1 on the founder Deploy page
**Performance · `src/app/founder/deploy/page.tsx:148-153`**
`pipelineList.map(async row => loadPartnerScore(...))` runs a ~7-query loader once per interested investor. `pipelineList` grows with every investor who engages — the code comment even flags it: _"if this list grows, move to a snapshot table."_
**Impact:** Page render scales as `N_investors × 7` round trips. ~40 investors ≈ 280 queries on one core founder page.
**Fix:** Precompute partner scores into a snapshot table (refreshed by the existing orchestration cron) and read with one `.in("investor_id", ids)`. Short term: cap the list and batch the underlying reads (see H4).

---

## HIGH

### H1 · `/api/email/inbound` auth is fail-open
**Security · `src/app/api/email/inbound/route.ts:67-73`**
The shared-secret check runs only `if (secret)` — when `INBOUND_WEBHOOK_SECRET` is unset, the endpoint is fully open, then writes inbound messages into threads via service role, routed by a reply `+token`.
**Impact:** In any env missing the var, an attacker who learns/guesses a reply token can inject spoofed emails (arbitrary sender/subject/body) into a user's thread.
**Fix:** Fail closed — reject with 503 when the secret is unset; always require it. Prefer provider signature verification if available.

### H2 · `/api/publish/webhook` performs no signature verification
**Security · `src/app/api/publish/webhook/route.ts:19-55`**
Unlike `marketing/webhook` (Svix) and `billing/webhook` (HMAC), this Resend delivery-event webhook accepts any unauthenticated POST, inserts into `publish_events`, and calls `advanceLeadStatus` on attacker-controlled `type`/`email_id`.
**Impact:** Forged delivery/open/click/bounce events poison analytics and push leads to `engaged`. Compounds with C1 (no RLS on the same table).
**Fix:** Verify the Svix signature with `RESEND_WEBHOOK_SECRET` exactly as `marketing/webhook` does; 401 on mismatch, 503 when unconfigured.

### H3 · Readiness scoring — standard-path point caps exceed declared factor maxima
**Correctness · `src/lib/ai/readiness-scoring.ts`** (revenue L367 vs L403; team L836 vs L909; market L1043 vs L1094; ip L1431 vs L1480; burn L1751 vs L1791; **pitch L1810 clamp 0..8 vs L1833 max 4 — double weight**)
Standard-path scorers `clamp()` to caps left over from an old 10-factor rubric, higher than the declared `max`. Totals are capped at `min(100, sum)` so they don't overflow, but relative weighting is skewed (pitch deck counts double) and per-factor UI shows nonsensical `15/11`, `8/4`. Industry-specialized paths were already fixed; standard paths were missed.
**Impact:** Non-specialized industries score up to ~20 points beyond budget with distorted weighting — a core investor-facing metric is wrong.
**Fix:** Change each standard-path clamp to the factor's declared max (18→15, 15→11, 13→10, 10→8, 10→8, 8→4).

### H4 · Partner-score loader waterfall + admin 12× fan-out
**Performance · `src/lib/investor-rating/load.ts:39-152`, `src/app/admin/partner-scores/page.tsx:42-52`**
`loadPartnerScore` runs 7+ independent queries strictly sequentially; the admin page calls it for up to 12 investors (~84 round trips). The first five queries key only on `investorId` and are fully independent.
**Impact:** ~7-hop serial waterfall per investor; this is the per-item cost that C2 multiplies.
**Fix:** `Promise.all` the five independent queries, then run the two dependent ones — roughly halves latency even before snapshotting.

### H5 · Learning analytics full-table scans (no filter)
**Performance · `src/lib/learning/progress.ts:394-413` (at-risk founders), `478-484` (leaderboard), `549-565` (module engagement)**
These load **all** rows of `learning_progress` / `founder_lesson_progress` / `learning_course_progress` with no `.eq()`/`.in()` filter, then join/group in JS. Indexes exist but are never used because the query has no filter → guaranteed seq scan.
**Impact:** Memory and latency grow with total platform activity, not the working set; degrades sharply as learning adoption scales. Two are founder-facing.
**Fix:** Push grouping into SQL (`select company_id, max(last_viewed_at) … group by`), or filter by candidate `companyIds`, or a materialized view refreshed on write.

### H6 · Type-safety escape hatches around the Supabase client
**Maintainability · 216 `as any`/`as unknown as` across 149 files;** whole-file `eslint-disable no-explicit-any` in `src/lib/ceo/*` and `src/lib/sales/*` (repeated `const db = supabase as any`)
The `ceo`/`sales` domains are almost entirely untyped against the DB because their tables aren't in the generated `src/lib/supabase/types.ts`.
**Impact:** Each cast disables column/return typing for the whole query chain, so schema drift (renamed/removed columns) compiles clean and fails at runtime.
**Fix:** Regenerate `types.ts` to include the newer tables (ceo_*, sales_*, diligence, events), delete the file-level casts. Where a table genuinely isn't generated yet, cast to a narrow hand-written row interface (`as CeoMeetingRow[]`), not `any`.

### H7 · Inconsistent API input validation — only ~35% of routes use zod
**Maintainability/Security · 168 of 482 `route.ts` use zod**
The other ~314 parse `await req.json()` and read fields directly, so malformed/missing fields become deep runtime errors or silent bad writes.
**Impact:** Two-thirds of write endpoints have no schema boundary; reviewers can't rely on validation being present.
**Fix:** Rule: every POST/PATCH/PUT validates its body with a shared `parseBody(req, schema)` helper returning `{data}` or a 400. Backfill highest-risk mutating routes first (billing, admin, diligence, sales/ceo).

### H8 · Duplicated currency/date formatting despite a shared util existing
**Maintainability · `toLocaleString`/`Intl.NumberFormat` across 152 files;** the exact USD formatter copy-pasted verbatim in a dozen+ places; `src/lib/ui/format-display.ts` exists but is barely used; billing uses yet another variant.
**Impact:** Formatting diverges (USD hardcoded some places, `undefined` locale others; some divide cents, some don't); any change to money display touches 100+ files. Biggest duplication in the codebase.
**Fix:** Expand `format-display.ts` with `formatCurrency(value,{cents?})`, `formatCompactNumber`, `formatDate`, `formatRelativeTime`; codemod call sites; add a lint guard against new inline `Intl.NumberFormat` in components.

---

## MEDIUM

### M1 · PostgREST `.or()` filter injection (unsanitized search input)
**Security · `src/app/api/founder/search/route.ts:39,59,100`; `src/app/api/sales/contacts/route.ts:28`; `.../facets/route.ts:15`; `src/lib/prospects/{founder-source.ts:44,lists.ts:35,store.ts:130}`**
User search term interpolated into `.or("col.ilike.%${q}%,…")` with no escaping of PostgREST metacharacters. Impact is bounded (RLS + ANDed `company_id` on the user path; staff-only on the service-role paths) so it can't cross tables or run SQL, but it's a scoping/hygiene weakness and a correctness bug (a name like "Smith, John" breaks the query).
**Fix:** Escape `,()` and wrap the term per PostgREST quoting rules, or chain per-column `.ilike()` instead of a hand-built `.or()` string.

### M2 · Internal error strings returned to clients
**Security · e.g. `src/app/api/billing/checkout/route.ts:55-56`, `src/app/api/marketing/contacts/route.ts:13,26,37`, `investor/portfolio-investments/[id]/route.ts:20,37`**
Caught exceptions echoed as `error.message`/`String(err)` leak Postgres/LemonSqueezy detail. Also: `requireRole()` calls `redirect()` (throws `NEXT_REDIRECT`) inside these try/catch on non-middleware routes → unauthorized callers get a 500 with the redirect string instead of a clean 401/403 (still denied, but leaky/fragile).
**Fix:** Return generic messages, log detail to Sentry. On non-middleware routes prefer the `requireApiProfile`/`requireStaffApi` result-object pattern over `requireRole()`.

### M3 · Booking TOCTOU double-booking race
**Correctness · `src/lib/scheduling/book.ts:29-60` (`assertSlotOpen`), `67-98` (`bookSlot`)**
Conflict check and event insert are separate steps with no lock/unique constraint between them; two concurrent requests for the same slot can both pass and both create events.
**Fix:** DB-level unique/exclusion constraint on host+time-range (or `SELECT … FOR UPDATE`), and treat the violation as "slot taken."

### M4 · `searchParams` mistyped as a plain object → filters silently ignored (Next.js 16)
**Correctness · `src/app/admin/analytics/page.tsx:43,47,49`; `src/app/admin/insights/page.tsx:17,21,23`**
Typed as a synchronous `Record` and read directly; in Next.js 16 it's a `Promise`, so `searchParams?.window`/`?.view` are always `undefined`. TS doesn't catch it (wrong type). The analytics window selector and `view` mode never take effect.
**Fix:** Type as `Promise<Record<string,string|string[]|undefined>>` and `await searchParams` first (sibling pages already do this).

### M5 · Business-plan PDF hard-indexes `years[0..2]`
**Correctness · `src/lib/business-plan/pdf.ts:61-65`** — `yr[1][key]`/`yr[2][key]` assume exactly 3 years; a legacy/hand-edited plan with <3 years throws inside the Promise executor and rejects the whole PDF.
**Fix:** `money(yr[i]?.[key] ?? 0)` or bail when `yr.length < 3` (sibling `pitch-deck/chart-data.ts` already `.slice(0,3)`).

### M6 · Business-plan falsely claims "cash-flow positive within 3 years"
**Correctness · `src/lib/business-plan/projections.ts:55`, `pdf.ts:71-73`** — the claim is derived from `runwayMonths === null`, but a large raise keeps cumulative cash positive even while burning every month.
**Impact:** Investor-facing doc can falsely claim positivity for a still-burning plan.
**Fix:** Base the claim on the sign of net cash flow (last month `net >= 0`), not runway nullness.

### M7 · Client forms with no try/catch — stuck spinners on network failure
**Correctness · `src/app/founder/investor-pipeline/InvestorPipelineClient.tsx:225-247`; `src/components/FounderAIVideoLesson.tsx:74,102,167`**
`setBusy(true)` → `await fetch` with no try/catch; a thrown fetch (offline) skips `setBusy(false)` → spinner stuck forever + unhandled rejection.
**Fix:** `try/catch/finally`, surface error in catch, reset loading in finally.

### M8 · Refetch effects without a cancellation guard — stale-response overwrite
**Correctness · `src/components/admin/learning/AdminCourseContentStudio.tsx:178,253,269,360`; `src/components/founder/learning/LessonWorksheet.tsx:27`**
Effects refetch on id changes with no `alive`/AbortController; a slower earlier response can resolve last and overwrite state for the newly-selected item.
**Fix:** `let alive = true` + cleanup, or AbortController (many siblings already do).

### M9 · Array index as React key in editable/removable lists
**Correctness · `src/components/playbook/EditModule.tsx:92,108`; `src/components/page-builder/PageBuilderLab.tsx:1058,1130,1214,1272`**
`key={i}` around controlled inputs in add/remove/reorder lists → deleting a middle row reconciles inputs by index, landing the wrong value/focus in the wrong row.
**Fix:** Use a stable per-item id as the key.

### M10 · Admin SPV workspace query fan-out
**Performance · `src/app/admin/spvs/page.tsx:104-109, 122-127`** — one query per SPV (`listSpvParticipationsForOpportunity`) and per company (compliance count), while the same function two lines above already uses the batched `.in()` pattern.
**Fix:** Add grouped variants (`.in("spv_opportunity_id", ids)`, `.in("company_id", ids)` + `group by`) mirroring `listAdminChecklistGrouped`.

### M11 · Marketing analytics — sequential daily loop + per-list N+1
**Performance · `src/app/admin/marketing/analytics/page.tsx:29-47, 94-97`** — 7 sequential daily count queries; per-list count N+1. `marketing_events` has an `event_type` index but no `(event_type, occurred_at)` composite.
**Fix:** One grouped `date_trunc('day', occurred_at)` query; batch list counts with `.in("list_id", ids)`; add composite index.

### M12 · Marketing sequence engine per-contact N+1
**Performance · `src/lib/marketing/sequences.ts:186-199, 278-300`** — per-contact `isUnsubscribed()` and `marketing_events` lookups inside `for` loops (background/cron, batch ≤500, so latency low but DB load grows linearly).
**Fix:** Pre-fetch unsubscribes/events for the whole group with `.in()`, look up from a Map. Keep the 150 ms send throttle.

### M13 · Errors caught but silently discarded (no logging)
**Maintainability · 346 bindingless `catch {}` across 243 files** vs only 54 `console.error`/Sentry captures. Many are legitimate graceful degradation, but the error is dropped and nothing is logged, so real failures (failing AI call, broken query) are invisible in production.
**Fix:** Standardize `catch (err)` + a thin `logError(err, context)` → Sentry (server)/PostHog (client) before the fallback. Reserve bindingless catch for truly-expected failures, with a comment.

### M14 · Oversized components/modules
**Maintainability · 33 files >600 lines** — worst: `readiness-scoring.ts` (2,270), `InvestableReadinessPanel.tsx` (1,354), `PageBuilderLab.tsx` (1,342), `admin-reports.ts` (1,182), `TasksClient.tsx` (1,101). Mix data fetching, state, derived calc, and JSX → hard to test/review/modify.
**Fix:** Extract sub-panels + `use…Data` hooks; split scoring data/config from logic. Target <~400 lines.

### M15 · Loose `Record<string, unknown>` domain payloads
**Maintainability · ~520 hand-written occurrences across 248 files** (heaviest `crm/load-console.ts` 24, `diligence/serialize.ts` 17). Defeats field-level typing at module boundaries; combined with H6, whole pipelines (diligence/crm/automation/voice) flow untyped.
**Fix:** Named interfaces where the shape is known; reserve `Record<string,unknown>` for open-ended JSON validated with zod at ingestion.

### M16 · Pervasive inline `style={{…}}` in a Tailwind v4 project
**Maintainability · 4,285 occurrences.** Many legitimate (dynamic widths/geometry), but the volume indicates static styling done inline, fragmenting the design system.
**Fix:** Migrate static inline styles (colors/padding/fixed sizes) to Tailwind/`design-tokens.ts`; keep inline only for render-time values.

---

## LOW

- **L1 · LemonSqueezy sig check can throw** — `src/lib/lemonsqueezy.ts:150-158`: `timingSafeEqual` throws `RangeError` on empty/mismatched-length `X-Signature` (fails closed but returns 500). Length-check first.
- **L2 · Voice webhook secret compared non-constant-time** — `src/app/api/voice/agent/route.ts:28`, `call-end/route.ts:31` use `!==` (endpoints dormant behind a kill switch). Use `timingSafeEqual`.
- **L3 · Regex HTML sanitizer on a public page** — `src/lib/icfo-events/sanitize-html.ts` (used in `events/[slug]/page.tsx`). Staff-only input, but prefer `sanitize-html`/DOMPurify for defense-in-depth.
- **L4 · Admin department gate fails open by design** — `src/proxy.ts:175-217`; documented, staff-only, acceptable, but a registry gap silently grants access. Periodically review registry completeness.
- **L5 · `pendingInterestCount` always equals total interests** — `src/lib/analytics/investor-analytics.ts:36-46`: every branch increments it. Increment only in the intended branch.
- **L6 · Funnel "biggest drop" highlights every sub-50% step** — `src/lib/analytics/funnel-email.ts:21`: colors red when `fromPrev<0.5`, caption says "biggest drop." Highlight only the `min` step.
- **L7 · Diligence PDF lacks stream/error handling** — `src/lib/diligence/pdf.ts:20-129`: no `reject`/`doc.on("error")`; a stream error hangs the promise. Add error handling + default arrays.
- **L8 · Webhook maps `past_due` → `active`** — `src/app/api/billing/webhook/route.ts:9-10`: grants full access during dunning. Confirm intent; consider a distinct grace state.
- **L9 · `ops_overdue_tasks` measured vs week-end, not now** — `src/lib/ceo/snapshot.ts:65`: counts tasks due later this week as overdue. Compare against "today" for the current-week snapshot.
- **L10 · Mount-once fetch effects without unmount guard** — widespread (CapTableClient, FinancialModelClient, etc.); harmless dev warning only. Optional `alive` guard.
- **L11 · Monthly-model vs projections rounding-order drift** — `financial-model/monthly.ts:38-47` vs `business-plan/projections.ts:59-72`: comment claims exact tie-out; `sum(round) ≠ round(sum)`. Aggregate unrounded then round once, or soften the comment.
- **L12 · `select("*")` over-fetch** — `marketing/sequences.ts:10-13`, `learning/progress.ts:24,50,154,321`, `admin-reports.ts` (23×). Enumerate needed columns.
- **L13 · Duplicated status/badge color maps** — 107+ files re-declare status→color; `components/ui/StatusBadge.tsx` exists but is inconsistently adopted. Route all pills through it.

---

## Verified sound (checked, not issues)

The flagged **billing enum concern is a false alarm** — the LemonSqueezy webhook normalizes `on_trial→trialing`, `cancelled/paused/unpaid/expired→canceled` before writing, so `admin-billing.ts`'s `ACTIVE`/`TRIAL` sets match stored values. Also confirmed correct: cap-table dilution math, matching/scoring weight sums, analytics UTC day-bucketing, cron routes (all validate `CRON_SECRET`), billing checkout/portal (session identity, never client IDs), IDOR-looking routes (`portfolio-investments/[id]`, `watchlist/[id]`, `companies/[id]` — all authorize via RLS or explicit ownership checks), no service-role client in any `"use client"` file, no secrets in `NEXT_PUBLIC_*`, 0 `console.log`, 0 truly-empty catches, only 42 non-null assertions.

---

## Suggested fix order

1. **C1** (RLS migration) — smallest change, closes a real data-exposure hole.
2. **H1 + H2** (fail-closed inbound webhook + publish webhook signature) — auth hardening, low effort.
3. **H3** (readiness scoring caps) — corrects a wrong investor-facing metric; ~6 one-line clamp changes.
4. **C2 + H4 + H5** (partner-score snapshot / parallelize / learning SQL aggregation) — the performance scaling cliff.
5. **H6 + H7 + H8** (regenerate types, zod backfill, format util) — highest maintainability ROI; mostly mechanical.
6. **M-tier** as the relevant files are touched; **L-tier** opportunistically.
