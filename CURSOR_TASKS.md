# CapitalOS — Cursor Task Briefs (Phase 1: Cleanup + Quick Wins)

Paste each section into Cursor's chat (Cmd+L / Cmd+K) one at a time as its own task.
Review the diff before accepting each one — especially #1 and #2, which touch git history and branding.

---

## 0. FIRST — verify what's actually deployed (do this before anything else)

**Why:** The live site (mvp-platform-theta.vercel.app) shows headline copy — "The operating system
for capital-ready companies... institutional platform" — that does **not exist anywhere** in this
local repo's source. The local code instead says "IFUNDCROWD helps companies organize diligence..."
Either Vercel is deploying a different branch/repo than the one checked out locally, or there are
unpushed/uncommitted changes living somewhere else.

**Prompt for Cursor (or just check yourself):**
> Run `git log --oneline -5` and `git remote -v` and `git status`. Then compare the deployed
> Vercel build's source commit (check the Vercel dashboard → Deployments → latest → "Source") against
> the local HEAD commit hash. Report any mismatch.

Do this before making changes — otherwise you may "fix" code that isn't even what's live.

---

## 1. Clean up the duplicated/nested repo structure

**Problem:** There's a recursive nested clone at `mvp-platform/mvp-platform/...` (same git remote,
same commit history as the outer repo) plus a stray empty `test.txt` at the project root. This will
confuse Cursor's indexing and anyone else opening the project.

**Prompt for Cursor:**
> Inspect the directory `mvp-platform/` at the project root — it appears to be a full duplicate
> nested clone of this same repo (same git remote `khristhetsy/mvp-platform`, same commit history).
> Confirm it's not a submodule or build artifact, then delete it along with the empty `test.txt`
> file at the project root. Update `.gitignore` if needed so this can't silently recur (e.g. add a
> rule against a folder named `mvp-platform/mvp-platform`).

---

## 2. Fix the leftover "IFUNDCROWD" branding (should be "CapitalOS")

**Problem:** Marketing copy across 7 files still says "IFUNDCROWD" — a previous product name —
while the logo, page title, and metadata say "CapitalOS". This is the kind of inconsistency that
makes a product feel unfinished to investors evaluating it.

Files affected: `src/app/page.tsx`, `src/app/founders/page.tsx`, `src/app/deals/page.tsx`,
`src/app/submit-company/page.tsx`, `src/components/MarketingNav.tsx`,
`src/components/MarketingFooter.tsx`, `src/components/ComplianceBlock.tsx`

**Prompt for Cursor:**
> Search the codebase for all occurrences of "IFUNDCROWD" and replace them with "CapitalOS",
> preserving surrounding sentence structure and capitalization rules. Then grep again to confirm
> zero remaining occurrences. Show me the diff for each file before applying.

---

## 3. Remove/replace the hardcoded "Acme Robotics Inc." preview card on marketing pages

**Problem:** The same dummy dashboard preview card (Acme Robotics Inc., Readiness Score 87,
Diligence Completeness 92%, "Investor Interest 23") appears identically on the Overview, Founders,
and Deals marketing pages — including on the public Marketplace page, which simultaneously says
"0 listings live on the marketplace." That contradiction will read as broken or fake to a visitor.

**Prompt for Cursor:**
> Find the component that renders the "Acme Robotics Inc. / Readiness Score 87 / Diligence
> Completeness 92%" preview card (likely built from `sampleCompany` in `src/lib/mock-data.ts`).
> Decide and implement one of: (a) keep it only on the Overview/Founders pages and clearly label it
> "Sample preview — not a live listing", or (b) remove it from the public Marketplace (`/deals`)
> page entirely so it doesn't contradict the "0 listings live" message. Recommend which is better
> for an investor-facing product and implement that.

---

## 4. Add Next.js loading/error/not-found UX states

**Problem:** There isn't a single `loading.tsx`, `error.tsx`, or `not-found.tsx` anywhere under
`src/app`. That means slow data fetches show a blank screen, and runtime errors likely show a raw
Next.js error overlay or stack trace to real users — a bad look for a platform handling financial data.

**Prompt for Cursor:**
> Add `loading.tsx`, `error.tsx`, and `not-found.tsx` files to the App Router route groups under
> `src/app` — at minimum for `founder/`, `investor/`, `admin/`, `deals/`, and `campaigns/`. Use
> skeleton/spinner states consistent with the existing Tailwind design system (see
> `src/components/MetricCard.tsx` and `SectionHeader.tsx` for the visual language), and make
> `error.tsx` show a friendly message with a retry action rather than exposing technical details.

---

## 5. Add `middleware.ts` for centralized route protection

**Problem:** Auth/role checks currently appear to live inside individual API routes
(`requireApiProfile`). There's no `middleware.ts`, so it's possible for a new admin or investor
page/route to be added later without protection, by mistake.

**Prompt for Cursor:**
> Create a `middleware.ts` at the project root that checks Supabase session + role for routes under
> `/admin`, `/investor`, and `/founder` (and their API equivalents), redirecting unauthenticated
> users to `/auth/sign-in` and unauthorized roles to an appropriate page. Keep the existing
> per-route `requireApiProfile` checks as defense-in-depth — middleware should be the first gate,
> not a replacement.

---

## Suggested order

Run these roughly in order — each is a separate Cursor session/commit so you can review and roll
back individually:

1. Verify deployment match (step 0) — 10 min, no code changes
2. Repo cleanup (step 1) — quick, but review carefully before committing
3. Branding fix (step 2) — quick, cosmetic, low risk
4. Marketing page placeholder fix (step 3) — quick, high visual impact
5. Loading/error/not-found states (step 4) — moderate effort, big polish payoff
6. Middleware (step 5) — moderate effort, security hardening

---

## Phase 2 (after the above lands)

Once these are done, the next priorities to discuss:
- Test coverage for auth, AI report generation, and admin approval flows (currently zero tests)
- Accessibility pass (`aria-`/`role` attributes currently in only 9 of 31 component/page files)
- Mobile responsiveness review of the founder/investor/admin dashboards

Happy to draft Cursor briefs for these once Phase 1 is merged.
