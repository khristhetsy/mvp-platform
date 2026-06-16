# CapitalOS — Cleanup + Quick Wins (Phase 1)

Tool-agnostic task briefs. Tackle each as its own change/commit so you can review the
diff and roll back individually — especially #1 and #2, which touch repo structure and branding.

> Note: this list predates recent work — some items may already be addressed (e.g. route
> protection now lives in `src/proxy.ts`, and some `loading.tsx` states exist). Verify current
> state before acting on each item.

---

## 0. FIRST — verify what's actually deployed (do this before anything else)

**Why:** The live site (mvp-platform-theta.vercel.app) has shown headline copy — "The operating system
for capital-ready companies... institutional platform" — that does **not exist anywhere** in this
local repo's source. The local code instead said "IFUNDCROWD helps companies organize diligence..."
Either Vercel is deploying a different branch/repo than the one checked out locally, or there are
unpushed/uncommitted changes living somewhere else.

**How to check:**
Run `git log --oneline -5`, `git remote -v`, and `git status`. Then compare the deployed Vercel
build's source commit (Vercel dashboard → Deployments → latest → "Source") against the local HEAD
commit hash. Report any mismatch. Do this before making changes — otherwise you may "fix" code that
isn't even what's live.

---

## 1. Clean up any duplicated/nested repo structure

**Problem:** A recursive nested clone at `mvp-platform/mvp-platform/...` (same git remote, same commit
history as the outer repo) plus a stray empty `test.txt` at the project root will confuse editor
indexing and anyone opening the project.

**Task:** Inspect `mvp-platform/` at the project root — if it's a full duplicate nested clone (same
remote `khristhetsy/mvp-platform`, same history) and not a submodule or build artifact, delete it
along with the empty `test.txt`. Update `.gitignore` so this can't silently recur (e.g. a rule
against a folder named `mvp-platform/mvp-platform`).

---

## 2. Fix any leftover "IFUNDCROWD" branding (should be "CapitalOS")

**Problem:** Marketing copy in several files may still say "IFUNDCROWD" — a previous product name —
while the logo, page title, and metadata say "CapitalOS". This inconsistency makes the product feel
unfinished to investors evaluating it.

Files historically affected: `src/app/page.tsx`, `src/app/founders/page.tsx`, `src/app/deals/page.tsx`,
`src/app/submit-company/page.tsx`, `src/components/MarketingNav.tsx`,
`src/components/MarketingFooter.tsx`, `src/components/ComplianceBlock.tsx`

**Task:** Search the codebase for all occurrences of "IFUNDCROWD" and replace with "CapitalOS",
preserving sentence structure and capitalization. Then grep again to confirm zero remaining
occurrences.

---

## 3. Remove/replace the hardcoded "Acme Robotics Inc." preview card on marketing pages

**Problem:** The same dummy dashboard preview card (Acme Robotics Inc., Readiness Score 87,
Diligence Completeness 92%, "Investor Interest 23") may appear identically on the Overview, Founders,
and Deals marketing pages — including the public Marketplace page, which simultaneously says
"0 listings live on the marketplace." That contradiction reads as broken or fake to a visitor.

**Task:** Find the component that renders the preview card (likely built from `sampleCompany` in
`src/lib/mock-data.ts`). Either (a) keep it only on the Overview/Founders pages and clearly label it
"Sample preview — not a live listing", or (b) remove it from the public Marketplace (`/deals`) page so
it doesn't contradict the "0 listings live" message. Recommended: (b) for the investor-facing page.

---

## 4. Add Next.js loading/error/not-found UX states

**Problem:** Sparse `loading.tsx` / `error.tsx` / `not-found.tsx` coverage under `src/app` means slow
fetches show a blank screen and runtime errors may expose a raw Next.js error overlay to real users —
a bad look for a platform handling financial data.

**Task:** Add `loading.tsx`, `error.tsx`, and `not-found.tsx` to the App Router route groups under
`src/app` — at minimum `founder/`, `investor/`, `admin/`, `deals/`, and `campaigns/`. Use
skeleton/spinner states consistent with the existing Tailwind design system, and make `error.tsx`
show a friendly message with a retry action rather than technical details.

---

## 5. Centralized route protection (verify current state)

**Status:** Middleware now lives at `src/proxy.ts` (intentional, exported with `config.matcher`) and
guards `/founder/*`, `/investor/*`, `/admin/*` and their API counterparts. Confirm coverage is
complete and keep per-route `requireRole` / `requireApiProfile` checks as defense-in-depth — the
middleware should be the first gate, not a replacement.

---

## Suggested order

1. Verify deployment match (step 0) — ~10 min, no code changes
2. Repo cleanup (step 1) — quick, review carefully before committing
3. Branding fix (step 2) — quick, cosmetic, low risk
4. Marketing page placeholder fix (step 3) — quick, high visual impact
5. Loading/error/not-found states (step 4) — moderate effort, big polish payoff
6. Confirm middleware coverage (step 5) — security hardening

---

## Phase 2 (after the above lands)

- Test coverage for auth, AI report generation, and admin approval flows
- Accessibility pass (`aria-`/`role` attributes)
- Mobile responsiveness review of the founder/investor/admin dashboards
