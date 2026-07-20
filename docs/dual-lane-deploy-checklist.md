# Dual-Lane Deploy Checklist

Ship checklist for the Reg CF dual-lane build: **Lane A** (public Reg CF marketplace) + **Lane B** (private investor matching), plus the founder capital-structure onboarding step and billing guardrails.

Run top to bottom. Do **staging first**, verify, then production.

---

## 1. Database migrations — run in order

Apply in the Supabase SQL editor (or CLI), **staging → verify → production**. Order matters: each builds on the previous.

1. `supabase/migrations/20260719006_offering_type.sql`
   - `offering_type` enum; `companies.offering_type` (default `not_raising`) + `offering_type_attested_at` / `_by`.
2. `supabase/migrations/20260719007_marketplace_listings.sql`
   - `listing_status` enum; `marketplace_listings` (tombstone cols, `company_id`, `slug`, `readiness_band`); `trg_reg_cf_only` + auto-pause triggers; one-live-per-company exclusion constraint; public-read RLS; `listing_interest` (RLS on, no client policies).
3. `supabase/migrations/20260719008_investor_founder_matches.sql`
   - `match_status` enum; `investor_founder_matches`; `profile_view_log` (append-only); own-match read RLS + `investor_read_introduced_companies` on `companies`.

**Post-migration RLS smoke tests** (spec §8/§9):

- Anon selects `marketplace_listings` → only `status = 'live'` rows.
- Anon selects `companies` → **0 rows**.
- `insert into marketplace_listings` for a non-`reg_cf` company → exception (`trg_reg_cf_only`).
- Investor with a `suggested`/`investor_notified` match → cannot read the founder `companies` row; with `introduced` → can.
- `brief_description` > 280 chars → rejected at DB level.
- Two `live` listings for one company → blocked by exclusion constraint.

---

## 2. Environment variables

| Var | Default | Set when |
|---|---|---|
| `CRON_SECRET` | (required) | Already set — reused by `/api/cron/matching`. |
| `INVESTOR_OUTREACH_LIVE` | off | **Counsel-approved** intro copy only. |
| `MATCHING_EMAILS_LIVE` | off | **Counsel-approved** match/intro email copy only. |
| `MARKETPLACE_INTEREST_EMAILS_LIVE` | off | **Counsel-approved** "offering live" email copy only. |
| `NEXT_PUBLIC_MARKETPLACE_SAMPLE_MODE` | off | **Must stay off in production** (renders fictional sample cards). |
| `INTEREST_IP_SALT` | optional | Set a secret for stronger express-interest rate-limit hashing. |

All three `_LIVE` email flags **stay off until securities counsel signs off** on the copy. In-app notifications fire regardless (they respect user prefs).

---

## 3. Vercel cron

`vercel.json` adds `GET /api/cron/matching` at `0 6 * * *` (protected by `CRON_SECRET`). It generates `suggested` matches and promotes them to `investor_notified`. Confirm it appears in the Vercel Crons dashboard after deploy.

---

## 4. Rollout behavior to expect

- Every existing company defaults to `offering_type = 'not_raising'`. **Public `/deals`, `/investors`, and `/marketplace` will be empty of those companies until each founder attests Reg CF** — this is the intended fail-closed compliance posture.
- Founders are auto-prompted to classify via a blocking modal (`OfferingTypePrompt` in `FounderAppShell`) on next login. As they attest Reg CF, they repopulate public surfaces.
- Non-Reg-CF (Reg D / not-raising) founders never appear on any public surface and are never shown the "List on marketplace" nav entry (fail-closed).

---

## 5. Counsel review before launch (spec §7)

- Global public footer + per-card disclosure (`src/lib/marketplace/copy.ts`).
- Onboarding disclosure + confirmations (`src/lib/onboarding/offering-type-copy.ts`).
- Rule 206 express-interest disclaimer (`src/lib/marketplace/copy.ts`).
- Email templates (all placeholder / not-approved): `src/lib/matching/email-templates.ts`, `src/lib/marketplace/interest-emails.ts`, `src/lib/outreach/intro-template.ts`.
- Terms of Service: founder attestation of exemption, tombstone content rules, no-transaction-role position.
- Portal allowlist (`src/lib/marketplace/portal-allowlist.ts`) — review quarterly.

---

## 6. Feature inventory (all built + verified: eslint + scoped tsc; unit tests for amount formatter + match state machine)

**Onboarding** — `/founder/offering-type` capital-structure step + attestation; Reg-CF-gated Marketplace nav; classification prompt for existing founders.

**Lane A (marketplace)** — public `/marketplace` + `/marketplace/[slug]` (ISR, tombstone cards, express interest with Rule 206 + honeypot + rate limit + dedupe); founder listing creation (`/founder/marketplace/new`, Reg-CF gated) → admin review queue (`/admin/marketplace`) → live; sitemap; interest-list "offering live" notification (counsel-gated).

**Lane B (matching)** — schema/RLS; consent state machine + tests; engine + cron; anonymized cards; investor match list + founder approval queue; view-audit log + "who viewed" count; in-app lifecycle notifications; gated email templates.

**Billing** — flat-only `PriceType` guardrail (`src/lib/billing/plan-types.ts`).

**Compliance patch** — legacy `/deals` + `/investors` gated to `offering_type = 'reg_cf'` (audit finding).

---

## 7. Rollback notes

- Code is additive; reverting the feature commits restores prior behavior.
- Migrations are additive (new tables/columns/enums). To fully revert, drop the three new tables, the two triggers, the `companies.offering_type*` columns, and the three enums — but the `companies.offering_type` gate on `/deals` will error if the column is dropped while the code still references it, so revert code and schema together.
- Email stays off by default, so there is no outbound-comms risk from a partial rollout.
