# Investor Rating — Technical Spec (v1 proposal)

> Status: proposal for review. Not yet built. Scopes a v1 "investor engagement &
> reliability" rating computed entirely from on-platform behavior.

## 1. Principles

1. **Behavioral, not subjective.** Score only observed on-platform activity. No
   "quality" opinions, no off-platform portfolio, no founder star-ratings.
2. **Follow-through beats activity.** Expressed interest is cheap; honored
   pledges and opened deal rooms are not. Weight completion highest.
3. **Rates, not raw counts.** Resistant to spray-and-pray gaming and fair to
   newcomers.
4. **Recency-weighted.** Recent behavior counts more; dormant investors decay.
5. **Transparent.** Investors can see their own metrics. Founders see a tier +
   the supporting facts — never a hidden grade.
6. **Cold-start = "New", never "Low."** Below a data threshold, show facts but no
   composite tier.

## 2. Pillars, signals, and weights

Composite is a weighted sum of four pillar subscores (each 0–100):

```
score = 0.40 * followThrough
      + 0.25 * responsiveness
      + 0.20 * credibility
      + 0.15 * trackRecord
```

### Pillar 1 — Follow-through / reliability (40%)
The anti-ghosting core. Source tables: `investor_interests`, `investor_activity`,
`deal_rooms`, `spv_closing_reviews`.

| Signal | Definition | Source |
|---|---|---|
| `conversionRate` | deal rooms opened ÷ interests expressed | `deal_rooms` / `investor_interests` |
| `pledgeHonorRate` | pledges reaching a closing ÷ pledges made | `spv_closing_reviews.investor_closing_status` / `investor_interests.pledge_amount` |
| `ghostRate` | interests with no deal room AND no message within 14 days ÷ interests | `investor_interests` + `thread_messages` |

```
followThrough = 100 * (0.5 * conversionRate + 0.5 * pledgeHonorRate)
              - 100 * min(ghostRate, 0.3)        # ghosting penalty, capped
followThrough = clamp(followThrough, 0, 100)
```

### Pillar 2 — Responsiveness (25%)
Source: `thread_messages` (`sender_id`, `created_at`, `read_at`).

| Signal | Definition |
|---|---|
| `replyRate` | threads where the investor replied to a founder message ÷ threads where a founder messaged them |
| `medianResponseHours` | median(investor reply timestamp − preceding founder message timestamp) |
| `recencyMultiplier` | decay by days since last activity (1.0 ≤ 30d, 0.7 ≤ 90d, 0.4 ≤ 180d, 0.2 otherwise) |

```
responseTimeScore = 100 if median < 24h, 70 if < 72h, 40 if < 7d, else 15
responsiveness = recencyMultiplier * (0.6 * 100*replyRate + 0.4 * responseTimeScore)
```

### Pillar 3 — Credibility / capacity (20%)
Source: `investor_profiles`, plus pledge consistency.

| Signal | Definition |
|---|---|
| `accredited` | verified accredited status (boolean) |
| `completeness` | share of {thesis, sectors, stages, check_size_min/max} that are filled |
| `consistency` | pledges that fall within stated check-size range ÷ pledges made |

```
credibility = 40 * (accredited ? 1 : 0)
            + 30 * completeness
            + 30 * consistency
```

### Pillar 4 — On-platform track record + tenure (15%)
Source: `spv_closing_reviews`, pledge history, profile `created_at`.

| Signal | Definition |
|---|---|
| `closedDeals` | count of closings the investor participated in |
| `honoredVolume` | total pledged amount that reached closing |
| `tenureMonths` | account age (mild contribution) |

```
trackRecord = clamp(
    55                                   # base
  + 12 * min(closedDeals, 3)             # up to +36 for 3+ closings
  + 9  * min(tenureMonths / 6, 1),       # up to +9 for 6+ months
  0, 100)
```
(Deliberately low weight so newcomers aren't punished; grows with real outcomes.)

## 3. Cold-start & normalization

- **Sample gate:** if `distinct founders engaged < 3`, return `status: "new"`
  with the raw facts but `score: null` and `tier: "new"`.
- **All pillar inputs are rates** (0–1) except `medianResponseHours` and counts,
  which are bucketed (above) before entering the formula.
- **Recency window:** weight interactions in the last 6 months at full value;
  older interactions contribute at the decayed `recencyMultiplier`.

## 4. Output model

```ts
type InvestorRatingTier =
  | "new"            // insufficient data
  | "highly_engaged" // 80–100
  | "active"         // 60–79
  | "developing"     // 40–59
  | "limited";       // < 40  (UI shows facts, soft framing — not a harsh label)

type InvestorRating = {
  status: "new" | "rated";
  tier: InvestorRatingTier;
  score: number | null;             // 0–100, null when "new"
  pillars: {
    followThrough: number;
    responsiveness: number;
    credibility: number;
    trackRecord: number;
  };
  facts: {
    interestsExpressed: number;
    dealRoomsOpened: number;
    conversionRate: number;
    pledgesMade: number;
    pledgeHonorRate: number;
    ghostRate: number;
    replyRate: number;
    medianResponseHours: number | null;
    accredited: boolean;
    closedDeals: number;
    lastActiveAt: string | null;
  };
  sampleSize: number;               // distinct founders engaged
};
```

## 5. Where it lives (mirrors the founder-journey pattern)

```
src/lib/investor-rating/
  types.ts        # InvestorRating, tier enum
  queries.ts      # per-pillar data loads (Supabase)
  evaluate.ts     # computeInvestorRating(supabase, investorId) -> InvestorRating
  tiers.ts        # score -> tier, thresholds, labels
```

- **Compute pattern:** a pure `evaluateInvestorRating(inputs)` + an async
  `computeInvestorRating(supabase, investorId)` loader — exactly like
  `evaluateFounderJourney` / `loadFounderJourney`.
- **Performance:** for v1, compute live (it's a handful of indexed queries). If it
  gets hot, add a nightly rollup table `investor_rating_snapshots` and read from
  it, recomputing on a schedule.

## 6. Visibility model

- **Investor (self):** sees their own pillar facts in their dashboard — framed as
  "your engagement on CapitalOS." This is what removes the shadow-profiling risk.
- **Founder:** sees the tier + facts on the investor's card / deal brief / CRM
  row. Lead with facts ("opened 4 of 5 deal rooms · replies within a day"), tier
  as the summary.
- **Admin:** sees everything for curation and matching inputs.
- **Never:** a hidden numeric grade founders see but investors can't.

## 7. Optional schema addition (precision, not required for v1)

```sql
alter table public.investor_interests
  add column if not exists outcome text
    check (outcome in ('pending','converted','stalled','withdrawn'));
```
Populated by a nightly job (or on closing events). Makes `followThrough` exact
rather than inferred from the funnel. v1 can ship without it.

## 8. Anti-gaming summary

- Expressed interest alone barely moves the score (it's the denominator, not the
  numerator).
- Follow-through is the heaviest pillar; ghosting is explicitly penalized.
- Rates + recency decay defeat volume-spamming and stale-activity coasting.

## 9. Suggested build phases

1. **Phase 1 — lib + admin read-only.** Build `investor-rating/`, surface in the
   admin investor view only. Validate the signal against real data before exposing
   it. (No risk, no user-facing change.)
2. **Phase 2 — founder-facing + investor self-view.** Add the founder card panel
   (tier + facts) and the investor's own-metrics view. Transparent both ways.
3. **Phase 3 — feed matching + add `outcome` column** for precise follow-through;
   optionally nightly snapshots for history/perf.

## 10. Open questions for you

- Confirm the four pillar **weights** (40/25/20/15) — tune to taste.
- Confirm the **"limited" tier framing** — show a soft label + facts, or suppress
  the tier and show facts only below a threshold?
- Phase 1 audience: admin-only first (recommended) or straight to founder-facing?
- Appetite for the optional `outcome` column in v1, or infer for now?
