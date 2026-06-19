# Investor Platform — Combined Spec (journey, qualification, Partner Score)

> Status: proposal + Phase 1 in progress. Captures the investor journey, the
> type-aware qualification flow, the Partner Score rating, the improvement
> coaching panel, and the hybrid deterministic+AI approach. Mirrors the existing
> founder-journey architecture.

---

## A. Investor journey

Four stages, parallel to the founder journey (Initialize → Qualify → Deploy →
Optimize). Stored on `investor_profiles` (or `profiles`) as `journey_stage`.

| Stage | What happens | Entry → exit |
|---|---|---|
| **Onboard** | Profile setup: type, thesis, check size, sectors, geographies, stages, accreditation self-declaration. No deal access. | Auto-advances when profile is complete. |
| **Qualify** | Upload internal verification documents (type-aware) → submit → **internal admin review** approves or requests changes. | Admin approval unlocks Access. |
| **Access** | Unlock founders directory, dealflow/marketplace, deal rooms, messaging, watchlist. Browse and **pledge** to deals. | Auto-advances on first pledge. |
| **Manage** | Manage pledges, commitments, and pledge pipeline / portfolio. (Mirror of founder Optimize.) | Terminal. |

Gating: existing `/investor/opportunities`, `/investor/deal-room`,
`/investor/messages` get wrapped in an `InvestorJourneyGate minStage="access"`,
exactly like `FounderJourneyGate minStage="deploy"`. Un-qualified investors see a
"complete verification to access deals" panel.

## B. Qualify — type-aware document checklist

Branch the Stage 2 checklist on `investor_profiles.investor_type`.

**Individual**
- Government ID (KYC)
- Accreditation evidence — **prefer a third-party verification letter** (CPA /
  attorney / broker-dealer) over raw income/net-worth docs to avoid storing
  sensitive financial PII
- Source-of-funds attestation
- Complete investor profile

**Institution** (VC fund, family office, PE, corporate VC)
- Entity formation documents
- Fund / AUM evidence (qualified-purchaser status)
- Authorized-signatory authorization (who may commit on the firm's behalf)
- KYB (Know-Your-Business) + beneficial ownership
- **Fast-track:** admin may pre-verify a known fund instead of full self-serve upload
- **Firm multi-seat (fast-follow):** one verified entity, multiple member users
  (partners/analysts) inheriting access — mirrors founder `company_members`. Bigger
  build (adds an org model); defer past v1.

**Security & compliance:** verification docs are the most sensitive data on the
platform. Admin/compliance access only, never visible to founders, with a
retention policy. **The required document set and verification policy must be
defined by compliance/legal** — this spec covers the mechanism, not the policy.

## C. Partner Score (investor rating)

Behavioral rating computed from on-platform activity. Name: **Partner Score**.
Tiers (a quality ladder, tunable): **Premier (80–100) · Established (60–79) ·
Active (40–59) · Emerging (<40) · New (insufficient data)**.

### Principles
1. Behavioral, not subjective. No off-platform portfolio, no founder star-ratings.
2. Follow-through beats activity (anti-gaming).
3. Rates, not raw counts.
4. Recency-weighted.
5. Transparent — investor sees their own metrics; founders see tier + facts.
6. Cold-start = "New", never "Low".

### Pillars & weights
```
score = 0.35*followThrough + 0.25*responsiveness + 0.20*credibility
      + 0.10*portfolioReadiness + 0.10*trackRecord
```

| Pillar | Signals | Source |
|---|---|---|
| Follow-through (35%) | conversion (deal rooms ÷ interests), pledge-honor rate, ghost penalty | `investor_interests`, `investor_activity`, `deal_rooms`, `spv_closing_reviews` |
| Responsiveness (25%) | reply rate, median response time, recency decay | `thread_messages` (sender_id, created_at, read_at) |
| Credibility (20%) | accredited (verified), profile completeness, pledge↔check-size consistency | `investor_profiles` |
| Portfolio readiness (10%) | avg readiness of companies they backed — **descriptor, light weight** (don't punish backing rough early companies) | `companies` readiness via backed `company_id` |
| Track record (10%) | closings, honored volume, tenure | `spv_closing_reviews`, profile `created_at` |

Cold-start gate: distinct founders engaged `< 3` → `status: "new"`, `score: null`,
facts still shown.

### Output (see `src/lib/investor-rating/types.ts`)
`{ status, tier, score, pillars, facts, sampleSize }` — facts lead the UI, tier
summarizes, number is secondary.

## D. Improvement panel ("Improve your Partner Score")

Private to the investor (their own dashboard only). The piece that turns the
score into behavior change.

- **Deterministic rules = source of truth.** Each pillar below target produces a
  specific, actionable nudge with a deep link ("2 founder messages waiting — reply
  →"). Same pattern as founder `buildRecommendedActions`.
- **AI = delivery layer (optional, graceful-degrade).** Claude Haiku turns the
  computed gaps into an encouraging, personalized coaching summary. Grounded
  strictly in the computed facts; **never invents numbers or promises outcomes**
  (same discipline as the diligence prompt). Falls back to the deterministic
  bullet list if the API key is absent or the call fails.
- Framing: positive coaching ("be a stronger partner"), never a threat.
- Suggested actions must be substantive (reply, follow through, verify) — never
  hollow (don't reward "express interest in more deals" or "log in daily").

## E. Visibility model

- **Investor (self):** full pillar facts + improvement panel.
- **Founder:** tier + facts on the investor card / deal brief (no improvement panel).
- **Admin:** everything, plus the review queue and curation.
- **Never:** a hidden number founders see but investors can't.

## F. Phased rollout

1. **Phase 1 (this build):** Partner Score scoring engine (`investor-rating/`) +
   unit tests + an **admin-only** view to validate scoring against real data. No
   user-facing change, no journey gates yet.
2. **Phase 2:** investor self-view + improvement panel (deterministic), then the
   AI coaching layer.
3. **Phase 3:** founder-facing tier+facts; feed the matching engine.
4. **Investor journey** (stages + gates + type-aware Qualify) tracked separately;
   build after Partner Score is validated, reusing the founder-journey lib pattern.

## G. Open decisions

- Pillar weights (35/25/20/10/10) and tier thresholds — tune to taste.
- Lowest tier framing — soft "Emerging" label or suppress tier below threshold.
- Required document sets — to be defined with compliance/legal.
- Firm multi-seat in v1 or fast-follow (recommended: fast-follow).
