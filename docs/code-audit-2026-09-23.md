# Code Audit — 2026-09-23

Read-only audit of the iCapOS MVP platform. Every finding below is backed by a
command, a file:line reference, or a count captured during the audit. No files
were changed and no git/supabase/vercel commands were run.

**Environment at audit time**
- Branch: `main` (clean working tree)
- Build: `npm run build` → **exit 0**, compiled in 64s (Next.js 16.2.6, Turbopack), 201 static pages generated
- Lint: `npm run lint` (eslint) → **exit 0, zero reported problems**
- Tests present: **165 test files** across `src/**`
- Source files (`.ts`/`.tsx`, excl. tests): **2,969** · TSX components: **1,169** · `"use client"` files: **623**
- API route handlers: **787** `route.ts` · Migrations: **405** SQL files in `supabase/migrations/`

> Note: CLAUDE.md states migrations run "0001 through 0068" and `"use client"` /
> route counts are not documented. The repo now has **405** migration files and
> **787** API routes — the docs are stale and understate the surface area.

---

## 1. Security

### 1.1 npm audit — 16 vulnerabilities (1 critical, 9 high, 6 moderate)
`npm audit` → exit 1. Metadata: `{"moderate":6,"high":9,"critical":1,"total":16}`.

| Severity | Package | Vulnerable range | Issue |
|----------|---------|------------------|-------|
| **CRITICAL** | `next` | 9.3.4-canary.0 – 16.3.2 | Middleware/Proxy bypass in App Router (Turbopack). **We run 16.2.6 and use `src/proxy.ts` as middleware — directly in scope.** |
| HIGH | `sharp` | <=0.35.4-rc.0 | Inherited libvips CVEs (CVE-2026-33327/33328) |
| HIGH | `postcss` | <=8.5.22 | XSS via unescaped `</style>`; arbitrary file-read |
| HIGH | `svgo` | 4.0.0–4.0.2 | `removeScripts` lets executable links through |
| HIGH | `pptxgenjs` | >=2.3.0 | via vulnerable `image-size` |
| HIGH | `image-size` | <=2.0.2 | ICNS/infinite-loop DoS |
| HIGH | `nanoid` | <3.3.18 | infinite loop when size is 0 |
| HIGH | `js-yaml` | 4.0.0–4.3.1 | quadratic CPU DoS (CVE-2026-…) |
| HIGH | `brace-expansion` | multiple | unbounded expansion OOM |
| HIGH | `@xmldom/xmldom` | <=0.8.14 | XML fragment injection |
| MOD | `dompurify` | <=3.4.12 | IN_PLACE hook removal leaves executable subtree (XSS) — relevant given HTML email/template editors |
| MOD | `undici` | <=6.27.0 | response desync via retry interceptor |
| MOD | `vitest`/`@vitest/mocker` | 2.1.0–4.1.10 | path traversal / arbitrary file read (dev-only) |
| MOD | `uuid` (<11.1.1) / `exceljs` | — | missing buffer bounds check |

- **Severity:** Critical.
- **Evidence:** `npm audit --json` (captured 2026-09-23); the Next.js advisory range includes our installed `next@16.2.6`.
- **Fix:** Upgrade `next` to a patched 16.3.x+ first (test proxy behaviour), then `npm audit fix` for the transitive DoS/XSS chain; `dompurify` matters most because of the marketing HTML editors.

### 1.2 Tables with RLS never enabled — 29 tables
`create table` count (normalized): 361 · `enable row level security` count: 332 · **29 created tables have no RLS enable statement and (spot-checked) no policies.**

Confirmed `rls=0 policies=0` for sensitive tables: `ir_notes`, `ir_reports`,
`data_room_access`, `social_accounts`, `social_settings`, `formd_firms`,
`investor_enrichment`, `processed_stripe_events`. Full list (29):
`data_room_access, fit_sessions, formd_deal_events, formd_firm_vehicles,
formd_firms, formd_principals, formd_screening, investor_enrichment,
investor_match_index, ir_activities, ir_goals, ir_match_stage_events, ir_matches,
ir_milestones, ir_notes, ir_projects, ir_reports, ir_tasks,
processed_stripe_events, social_accounts, social_alert_rules,
social_campaign_goals, social_campaigns, social_clicks, social_posts,
social_recurrences, social_settings, social_slots, social_variants`.

- **Severity:** High. These hold investor-relations notes, data-room access
  grants, Form D firm data, and social OAuth account rows. They are protected
  today only because the app reaches them through the service-role client
  (`createServiceRoleClient`), which bypasses RLS anyway — so any future use of
  the anon/authenticated key against them (or a leaked anon key) is unbounded read/write.
- **Evidence:** `supabase/migrations/*` — no `alter table … enable row level security` for these 29; `dd_*` tables *do* enable RLS (`20260621004_dd_module.sql:208-216`), proving the omission is inconsistent, not intentional policy.
- **Fix:** Add `alter table <t> enable row level security;` + explicit `service_role`/owner policies for each of the 29 (default-deny once enabled).

### 1.3 `using (true)` policies — 15 occurrences, mostly benign
`grep -niE "using ?\(true\)|with check ?\(true\)"` → 15 hits. Reviewed:
- **Benign (public read by design):** marketing site events/pages, `feature_flags`, `company_metric_snapshots`, learning badges/overrides — all `for select`.
- **Benign (scoped to service_role):** `platform_settings_service_all … to service_role using(true) with check(true)` (`20260728007_platform_settings.sql:11-14`) — service_role bypasses RLS regardless.
- **Benign (read-only, writes gated):** `internal_roles/permissions/role_permissions` use `for select to authenticated using(true)` with writes gated by `is_super_admin_user()` (`0042_internal_rbac.sql:233-268`).

- **Severity:** Low. No `using(true)` grants unrestricted **write** to `authenticated`/`anon`.
- **Fix:** None required; keep the pattern of pairing `using(true)` selects with a real `with check` on writes.

### 1.4 Service-role key usage — server-only, no client leakage
`createServiceRoleClient` from `@/lib/supabase/admin` is imported by ~60 server
files (founder/admin `page.tsx`, server actions, API routes). **Zero `"use client"`
files import it** (verified: loop over every importer's first line found no client component).

- **Severity:** Low (as a leakage risk) / **Medium (as an architecture smell)** — see §3.1.
- **Evidence:** `src/lib/supabase/admin.ts:1-8` carries a TODO explaining it still lacks `import "server-only"` because four modules (`investor/kyc.ts`, `matching/matching-center.ts`, `integrations/subscription-presets.ts`, `icfo-events/gamification.ts`) both import the admin client and export constants used by client code.
- **Fix:** Split those four constants into constant-only files, then add `import "server-only"` to `admin.ts` so any future client import fails the build.

### 1.5 Hardcoded secrets — none found
`grep -niE "(api_key|secret|password|token)\s*[:=]\s*['\"][A-Za-z0-9_-]{20,}"`
(excluding `process.env`, schemas, labels) → **0 results**. Secrets are read from env throughout.
- **Severity:** None. Good.

### 1.6 API auth posture — strong (verified after correcting for helper names)
Initial grep suggested 598/787 routes had "no auth" — a false alarm. Routes use
helper guards (`requireRole`, `requireApiProfile`, `requireInvestorWorkspaceSession`,
`requireUserProfile`, `getCurrentUserProfile`) plus `src/proxy.ts` middleware
covering `/api/founder/`, `/api/investor/`, `/api/admin/`. Recounting with the
real helpers: **132/787 routes reference no guard** (mostly GET/webhook/cron with
signature or `CRON_SECRET` checks). **Write-capable, unguarded, outside
middleware: exactly 3** — `/api/demo`, `/api/lead` (intentional public
lead-capture), and `/api/user/locale` (guarded by `getCurrentUserProfile`, false positive).

- **Severity:** Low. Only `/api/demo` and `/api/lead` are genuinely open, both by design.
- **Fix:** Add rate-limiting/BotID to `/api/lead` and `/api/demo`; otherwise no action.

---

## 2. Reliability

### 2.1 Test-to-source ratio
165 test files vs 2,969 source files (**~5.6% of files have a colocated test**).
Test suites are dense in pure-logic domains (crr, formd, icfo-events, sales,
social, email) and thin at the framework boundary.

- **Severity:** Medium.
- **Evidence:** `find src -name '*.test.ts*' | wc -l` = 165.

### 2.2 Untested critical paths
| Path | Tests found |
|------|-------------|
| `src/proxy.ts` (middleware — the RBAC gate) | **0** (402 lines, no test) |
| Auth (`src/lib/auth/**`, session helpers) | **1** (`src/lib/api/auth.test.ts`) |
| RBAC (`src/lib/rbac/**`) | **1** (`department-path.test.ts` only) |
| Billing | **1** (`billing/webhook-mapping.test.ts`) |
| Matching/fit | 8 (well covered) |

- **Severity:** High. The single highest-leverage security control (`proxy.ts`
  zone/role enforcement) and the permission engine (`rbac/`) are essentially untested.
- **Evidence:** counts above from `find`.
- **Fix:** Add a `proxy.test.ts` asserting each role↔zone matrix outcome + unauthenticated redirect, and RBAC permission-resolution tests including `LEGACY_STAFF_PERMISSIONS`.

### 2.3 Error handling gaps in API routes
- **238 / 787** `route.ts` files contain **no `try`** at all.
- **82** `.single()` calls under `src/app/api` (throws/errors on 0 or >1 rows if unhandled).

- **Severity:** Medium. Many no-`try` routes are trivial GETs, but `.single()`
  without a surrounding guard turns "no row" into a 500.
- **Evidence:** `find src/app/api -name route.ts | … grep -L try` = 238; `grep -rn '.single()' src/app/api` = 82.
- **Fix:** Prefer `.maybeSingle()` where 0 rows is valid; wrap route bodies in a shared `withRouteErrors()` helper that maps thrown errors to 4xx/5xx JSON.

---

## 3. Architecture

### 3.1 Service-role client used as the default data path
~60 server components/actions call `createServiceRoleClient()` directly (e.g.
every `src/app/founder/*/page.tsx`). This bypasses RLS for ordinary user reads,
which is why §1.2's missing RLS has had no visible impact — but it also means
**RLS is not the enforcement layer for most of the app; the code is.**

- **Severity:** Medium (systemic). One missed `.eq('owner_id', user.id)` filter in
  a service-role query = cross-tenant data exposure with no RLS backstop.
- **Evidence:** `grep -rn "createServiceRoleClient" src/app/founder` → 25+ page.tsx files.
- **Fix:** For user-scoped reads, prefer `createServerSupabaseClient()` (cookie/RLS-bound) and reserve the service-role client for genuinely cross-tenant admin/cron work.

### 3.2 `"use client"` overuse & client-side data fetching
- **623** files carry `"use client"` (≈53% of the 1,169 TSX components).
- **206** client files combine `useEffect` + `fetch(` (client-side data loading).
- **18** client files import the browser Supabase client / call `createClient()`.
- **139** `eslint-disable react-hooks/set-state-in-effect` directives — a proxy for effect-driven data loading that could be server-fetched or moved to an action.

- **Severity:** Medium. Client-fetch-in-effect hurts TTFB, waterfalls requests, and ships JS that a server component wouldn't.
- **Evidence:** counts above.
- **Fix:** Convert read-only `useEffect`+`fetch` panels to server components / server actions; the 139 `set-state-in-effect` disables are the priority worklist.

### 3.3 Duplicated env/role boilerplate
`Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)` is recomputed in ≥6 places
(`admin/page.tsx:159`, `system-health/page.tsx:35`, `companies/page.tsx:47`,
`next-best-actions/compute-admin-actions.ts:84`, `operations/system-snapshot.ts:171`,
`operations/launch-readiness.ts:109`). Same for the `requireRole([...])` +
`403 JSON` pattern repeated across marketing/sales routes.

- **Severity:** Low.
- **Fix:** Centralize env introspection in `src/lib/env.ts` (already has `hasServiceRole()` at `env.ts:85`) and adopt a single `withRole()` route wrapper.

---

## 4. Performance

### 4.1 Bundle sizes not emitted by the Turbopack build
`npm run build` (Turbopack) does **not** print per-route First Load JS sizes — the
route tree shows only render mode. So bundle sizes could not be measured directly.
Proxy signals used instead below.

- **Severity:** Informational.
- **Fix:** Run `next build --webpack` (or `@next/bundle-analyzer`) once to capture per-route byte sizes for a baseline.

### 4.2 Almost everything renders dynamically
Route tree: **13 static (○)** vs **1,139 dynamic (ƒ)** entries. Nearly every page
is server-rendered on demand — expected for an authed app, but marketing/legal
pages (`/about`, `/terms`, `/security`, `/pricing`) are also `ƒ` and could be static.

- **Severity:** Low.
- **Evidence:** `grep -c` on build route tree.
- **Fix:** Mark public marketing/legal routes static (no per-request data) to cut function invocations.

### 4.3 Potential N+1 and over-selection
- **397** files under `src/lib` contain `for (const …` or `.map(async` (awaited work in a loop — classic N+1 candidates).
- **486** `select("*")` calls across `src`/API — over-fetching wide rows (incl. the 2,584-line `types.ts` tables).

- **Severity:** Medium (needs per-site triage; not all loops hit the DB).
- **Evidence:** counts above.
- **Fix:** Batch loop queries with `.in(...)`; replace `select("*")` with explicit column lists on hot paths (list/search endpoints).

### 4.4 Foreign-key index coverage (needs DB-side confirmation)
Migrations declare **689** `references …` (FK relationships) but only **530**
`create index` statements. FKs without a covering index cause slow joins and
lock-heavy cascade deletes.

- **Severity:** Medium (unconfirmed exact gap — counts are heuristics, not a 1:1 map).
- **Fix:** Run the standard "FKs missing a covering index" query against the DB (below in §6) and add the missing indexes.

---

## 5. Maintainability

### 5.1 Lint is clean *because* of 478 inline suppressions
`npm run lint` reports 0 problems, but there are **478** `eslint-disable`
directives in `src`. Breakdown:

| Count | Rule |
|-------|------|
| 274 | `@typescript-eslint/no-explicit-any` |
| 139 | `react-hooks/set-state-in-effect` |
| 26 | `@next/next/no-img-element` |
| 15 | `react-hooks/exhaustive-deps` |
| 14 | `react-hooks/purity` |
| others | refs/immutability/require-imports |

Plus **270** `: any` / `as any` type escapes (100 `as any` outside tests) and **1** `@ts-*ignore`.

- **Severity:** Medium. The clean lint overstates health; 274 suppressed `any`s and 139 suppressed effect-purity warnings are latent type/render bugs.
- **Evidence:** `grep -rhoE 'eslint-disable…'` tallies above.
- **Fix:** Burn down `no-explicit-any` (start with the 100 `as any`) and the 26 `no-img-element` (swap to `next/image` for LCP wins).

### 5.2 Files over 800 lines — 24 files
Largest: `src/lib/supabase/types.ts` (2,584, generated — ok),
`src/lib/ai/readiness-scoring.ts` (**2,270**),
`src/components/marketing/TemplateVisualEditor.tsx` (**1,699**),
`src/app/admin/sales/contacts/[id]/ContactProfileClient.tsx` (**1,427**),
`src/components/investor/InvestableReadinessPanel.tsx` (1,364),
`src/components/page-builder/PageBuilderLab.tsx` (1,343),
`src/components/admin-events/EventDetailManager.tsx` (1,218),
`src/lib/reports/admin-reports.ts` (1,182), plus 16 more ≥800 lines (14 of them
`"use client"` components).

- **Severity:** Low–Medium. The 2,270-line `readiness-scoring.ts` and the 1,400–1,700-line client components are hard to test and ship large JS.
- **Evidence:** `find … | xargs wc -l | awk '$1>800'`.
- **Fix:** Extract pure scoring logic from `readiness-scoring.ts` into tested units; split the mega client components into subcomponents + server data loaders.

### 5.3 Dead code / unused exports — not measurable in-repo
No `knip`, `ts-prune`, or `depcheck` is installed (`node_modules/.bin` has none),
so unused exports can't be quantified without adding tooling. `console.log` in
non-test `src`: **0** (clean). TODO/FIXME/HACK: **2** (very low).

- **Severity:** Low (unknown coverage).
- **Fix:** Add `knip` as a dev dependency and run it in CI to surface unused exports/files/deps.

---

## 6. Data / Migrations

### 6.1 No rollback / down migrations
Only **14 / 405** migration files contain any `drop`/rollback statement, and those
are forward drops, not reversible down-migrations. The workflow is
forward-only (applied by hand in the Supabase SQL editor per project convention).

- **Severity:** Medium. A bad migration in production has no scripted reversal.
- **Evidence:** `grep -rli "drop table|-- rollback|-- down"` = 14/405.
- **Fix:** Adopt a `-- rollback:` comment block convention per migration (even if applied manually) so a reversal script exists for each schema change.

### 6.2 FK index coverage query (run against DB to confirm §4.4)
```sql
select conrelid::regclass as table, conname, a.attname as fk_column
from pg_constraint c
join lateral unnest(c.conkey) k(attnum) on true
join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
where c.contype = 'f'
  and not exists (
    select 1 from pg_index i
    where i.indrelid = c.conrelid
      and a.attnum = any(i.indkey[0:0])   -- FK column is leftmost in some index
  )
order by 1;
```

### 6.3 RLS enablement check (confirms §1.2 against live DB)
```sql
select relname from pg_class
where relkind = 'r' and relnamespace = 'public'::regnamespace
  and not relrowsecurity
order by 1;
```

- **Fix:** Enable RLS on every row returned by 6.3 (expect the 29 tables from §1.2), then add explicit policies.

---

## Top 10 — ranked by risk × effort

| # | Finding | Severity | Effort | One-line fix |
|---|---------|----------|--------|--------------|
| 1 | `next@16.2.6` in the critical Middleware/Proxy-bypass advisory range (§1.1) — and we use `proxy.ts` | Critical | Low | Upgrade to patched Next 16.3.x+, re-test proxy, then `npm audit fix` |
| 2 | 29 tables (IR notes, data-room access, social OAuth, Form D) have **no RLS** (§1.2) | High | Medium | `enable row level security` + default-deny policies on all 29 |
| 3 | `proxy.ts` + `rbac/` (the auth gate) have **no meaningful tests** (§2.2) | High | Medium | Add role×zone matrix test for proxy and RBAC permission-resolution tests |
| 4 | Service-role client is the default data path, bypassing RLS app-wide (§3.1) | Medium | High | Use cookie-bound client for user reads; reserve service-role for admin/cron |
| 5 | 9 high-severity transitive vulns (postcss/sharp/svgo/dompurify XSS+DoS) (§1.1) | High | Low | `npm audit fix`; prioritise `dompurify` (HTML editors) |
| 6 | 486 `select("*")` + 397 awaited-loop sites → over-fetch / N+1 (§4.3) | Medium | Medium | Explicit columns + `.in()` batching on list/search endpoints |
| 7 | FKs (689) outpace indexes (530); likely unindexed FKs (§4.4/§6.2) | Medium | Low | Run §6.2 query, add covering indexes |
| 8 | 238/787 routes have no `try`; 82 raw `.single()` → 500s (§2.3) | Medium | Medium | `withRouteErrors()` wrapper + `.maybeSingle()` where 0 rows is valid |
| 9 | Clean lint masks 478 disables (274 `any`, 139 effect-purity) (§5.1) | Medium | Medium | Burn down `no-explicit-any`/`as any`; fix `set-state-in-effect` |
| 10 | Forward-only migrations: 391/405 have no rollback (§6.1) | Medium | Low | Adopt a `-- rollback:` block per migration |

---

*Generated by a read-only audit on 2026-09-23. All counts reproducible via the
commands cited inline. No source files were modified.*
