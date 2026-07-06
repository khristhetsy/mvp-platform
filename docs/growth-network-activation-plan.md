# Network Activation Growth Plan — "Your match is waiting"

A plan to turn iCapOS's owned Odoo network (≈12k founder leads, ≈6k investor leads) into activated, paying members using a single loop: **readiness score (free) → potential match (teaser) → 3-day trial (reveal) → paid (intro).**

The strategy is a two-sided reactivation engine. Each side is the bait for the other, and the readiness score is the front door.

---

## 1. The loop in one line

> You have matches in our network → but you're a 62/100 → here's how to become an 80 → then we connect you.

- **Diagnosis (free):** an instant investor-readiness score.
- **The gap (trial):** the 3 things holding the score back, plus the tools to fix them.
- **The reward (paid):** anonymized matches become named intros once both sides opt in.

Every step runs on assets that already exist in the product — this is mostly packaging and sequencing, not net-new engineering.

---

## 2. Assets we already have (reuse, don't rebuild)

| Need | Existing in iCapOS |
|---|---|
| The audience | `crm_contacts` — 12k founder + 6k investor leads (Odoo-synced) |
| Fit matching | `src/lib/matching/` founder ↔ investor logic |
| Readiness scoring | Founder readiness feature (`/founder/readiness`, feature key `readiness`) |
| Investor pipeline | `investor-crm/` |
| Outbound email | Marketing engine + scheduled/sequence crons + verified Resend sender |
| In-app nudges | `notifications/` (digests, orchestration) |
| Value the trial unlocks | Business plan, pitch deck, data room, AI tools |
| Monetization | Subscription plans incl. `founder_trial` (3-day), `founder_basic`, `founder_professional`, `investor_free` |

The new work is the connective tissue: a match-teaser table, an instant-score seeder, the anonymized reveal gate, and the reactivation campaign.

---

## 3. What to build — phased

### Phase 0 — Foundations (data + compliance) — week 1
- **Match pass:** batch-run the matching engine over founders × investors in `crm_contacts`; write `network_matches` records (founder_id, investor_id, fit_score, reasons, status). Only store real matches above a fit threshold.
- **Instant readiness seed:** compute a partial readiness score for each founder lead from the Odoo data we already hold, so the score is instant (no 30-minute form). It rises as they complete plan/deck/data room.
- **Compliance baseline:** unsubscribe link + suppression list, sender identity, per-region opt-out handling (B2B legitimate-interest basis, honor opt-outs). This is standard CRM re-engagement, not cold outreach — but the plumbing must be right before any send.

### Phase 1 — Readiness as the lead magnet — week 1–2
- **Public/gated score reveal:** a landing page that shows the founder their score number for free, with the detailed breakdown + "how to raise it" locked behind trial.
- **Movable score:** each gap maps to a product action ("finish data room: +8"). Progress is the engagement engine during trial.
- **"Give the number, gate the map":** enough to hook, enough held back to convert.

### Phase 2 — Match teaser + double opt-in — week 2–3
- **Anonymized teaser:** "3 investors in our network match your thesis — Seed, B2B SaaS, $250k–$1M, 87% fit." Count + blurred profile, never a name or a specific deal.
- **Double opt-in reveal:** names/intros unlock only after *both* sides opt in. Protects the securities posture (marketing the platform, not soliciting a security) and preserves the value (they must join to see it).
- **Investor mirror:** investors get "N founders match your thesis — see who," gated the same way.

### Phase 3 — Reactivation campaign to the 18k — week 3–4
- **Segment + throttle:** start with highest-fit + most-recently-engaged leads; warm the domain; drip, don't blast (protect the deliverability you already fixed).
- **Two funnels, one loop:** founder track (readiness + matches) and investor track (matches + deal quality signal).
- **Triggered, truthful nudges:** "2 new matches this week," "someone viewed your profile" — only when true.

### Phase 4 — Trial → reveal → convert — week 4+
- **Trial framing:** 3-day full access for urgency, **plus a permanent free readiness score** afterward so lapsed trials stay reachable (the freemium tail is often worth more than the trial length).
- **Loss aversion at the edge:** "Your full report and 3 matches lock in 24h."
- **Convert to paid** to send/receive intros and keep the tools.

---

## 4. The funnel, touch by touch

1. **Email 1 (hook):** "Your investor-readiness score is ready — and 3 investors in our network match you." → landing.
2. **Landing (free reveal):** score number shown; breakdown + matches blurred; CTA "Start 3-day trial to unlock."
3. **Trial day 0:** full score + top 3 gaps + one-click actions (finish plan/deck/data room). Watch the score move.
4. **Trial day 1–2:** "You're at 71 — investors here typically engage at 75+. Two steps to go." Nudges via notifications.
5. **Reveal:** as gaps close, matches surface (still name-gated until both opt in).
6. **Convert:** paywall the actual intro + ongoing tools; "your matches expire in 24h."
7. **Freemium tail (no-convert):** keep the free score; re-engage monthly with new matches.

Investor side runs the mirror: quality-signal ("founders scoring 80+ in your thesis"), opt-in, reveal, connect.

---

## 5. Metrics to watch

- **Email:** delivery, open, click, unsubscribe/spam (guardrail — keep spam < 0.1%).
- **Activation:** landing → score-view → trial-start rate.
- **Engagement:** trial score-lift (points gained), tool completion (plan/deck/data room).
- **Conversion:** trial → paid; double opt-in match acceptance rate.
- **Loop health:** matches created, mutual opt-ins, intros made.
- **North star:** activated members from the owned network (both sides).

---

## 6. Guardrails (don't skip)

- **Truthful matches only** — a fake or bad first match destroys the whole loop.
- **Anonymized until mutual opt-in** — never expose one lead's identity/PII to another before consent.
- **Marketing the platform, not the security** — teaser = "join to see your match," never a specific deal to a non-consenting/unverified investor.
- **Throttle + warm** — protect domain reputation; segment before scaling.
- **Legal check** — have securities counsel review the *in-platform* intro step (506(b) pre-existing relationship vs 506(c) accreditation) and the email copy. The marketing layer is low-risk; the deal-intro step is where you want a sign-off.

---

## 7. Suggested build order (fastest path to a live test)

1. `network_matches` table + matching batch job (Phase 0).
2. Instant readiness seed from Odoo data (Phase 0/1).
3. Score-reveal landing with gated breakdown (Phase 1).
4. Anonymized teaser + double opt-in reveal (Phase 2).
5. One segmented reactivation campaign to a **500-lead pilot** (Phase 3) — measure before scaling.
6. Trial paywall + freemium-score tail (Phase 4).

Start with the pilot (steps 1–5 on 500 leads) to prove open/trial/convert rates before touching the full 18k.

---

*Prepared for iCapOS. Educational/marketing material — the in-platform investor-intro step should be reviewed by securities counsel before enabling outbound to non-members.*
