# Investable Readiness — scoring model spec

Status: **draft for review.** This is the engine behind the Investable Readiness card, section,
stage, and report mockups. Nothing above is buildable until the decisions marked **[DECIDE]** are made.

> Naming: this is the founder-facing **Investable Readiness** score. In code/DB it maps to
> `company_readiness_scores`. Do **not** use `crr` (project convention: `lead_prescore`).

---

## 1. What it is — and how it differs from Capital Readiness

| | Capital Readiness Rating | Investable Readiness |
|---|---|---|
| Question | *Are you prepared?* | *Are you compelling?* |
| Measures | Completeness of materials (docs, profile, data room) | Attractiveness of the business to investors |
| Founder raises it by | Uploading / filling things in | Improving the business (traction, margins, defensibility) |
| Source | Rule-based checklist | Weighted factor model over extracted signals |
| Can be 100 while the other is low? | Yes — fully prepared, not yet investable | Yes |

The two must never overlap. Capital Readiness = **preparation you control**. Investable Readiness =
**judgment of the business**.

---

## 2. The score

`Investable Readiness = Σ (factor_score × factor_weight)`, rounded to an integer 0–100.

Each `factor_score` = weighted average of its **signals**. Each signal is scored 0–100 by a
**deterministic rule** over a value that is either read directly from structured data or extracted
once from a document (see §4). **The scoring math is pure — no LLM in the rollup.** That is what makes
the "+X points" simulation (§6) honest.

### Factors & weights (stage-calibrated)

Weights are **stage-aware** — at seed, investors underwrite people and early proof, not mature
financials. Store weights per (sector, stage) so they can be tuned without code changes.

| Factor | Seed weight | Rationale |
|---|---|---|
| Team | 25% | At seed, the team is the primary bet |
| Traction | 25% | Early proof is the top differentiator between fundable and not |
| Market | 20% | Size + growth + tailwind |
| Product / moat | 15% | Differentiation and defensibility |
| Unit economics | 15% | Scalability signal; heavier at Series A+ |

(Later stages shift weight from Team → Traction/Unit economics. Ship seed first.)

---

## 3. Bands

| Band | Range | Meaning |
|---|---|---|
| Strong | 75–100 | Competitive for a term sheet |
| Moderate | 55–74 | Fundable with focused improvement |
| Early | 35–54 | Not yet investable; clear gaps |
| Foundational | 0–34 | Too early / too little data |

Threshold of note: **75 = "Strong"** — the number the outreach nudge/gate references (§7).

---

## 4. Signals — data sources & scoring rules

For each signal: **source**, **how the value is obtained**, and the **scoring rule**. Critically,
distinguish **missing** (no data → low score, but the fix is "add data") from **weak** (data present,
value poor → the fix is "improve the business"). The report must say which.

### Team (25%)
| Signal | Sub-wt | Source | Rule |
|---|---|---|---|
| Domain experience | 35% | Profile / bio (LLM-extracted years-in-sector) | ≥8 yr →100; 4–7 →75; 1–3 →50; <1 →25 |
| Track record | 25% | Bio / diligence (prior exits, senior roles) | Prior exit →100; senior operator →75; first-time →50 |
| Team completeness | 25% | Roster (roles present) | Tech+commercial →100; one gap →65; solo →40 |
| Advisors | 15% | Profile | Relevant, named →100; generic →60; none →40 |

### Traction (25%)
| Signal | Sub-wt | Source | Rule |
|---|---|---|---|
| Revenue growth | 40% | Financials (MoM trend) | ≥15%/mo →100; 5–15 →75; flat →45; **missing →30** |
| Customers | 25% | Diligence / deck | Named paying logos →100; pilots →60; none →35 |
| Retention | 20% | Financials | Repeat/renewal data strong →100; **missing →35** |
| Pipeline | 15% | Diligence | Signed LOIs →100; qualified pipeline →65; **missing →40** |

### Market (20%)
| Signal | Sub-wt | Source | Rule |
|---|---|---|---|
| TAM | 30% | Deck (LLM-extracted, source-checked) | >$1B, cited →100; unsourced →55 |
| Growth | 25% | Deck | >10% CAGR →100; 3–10 →70; flat →40 |
| Tailwind | 20% | Diligence | Clear regulatory/secular tailwind →100; none →55 |
| Beachhead clarity | 25% | Deck | Sharp SAM/SOM wedge →100; generic →55 |

### Product / moat (15%)
| Signal | Sub-wt | Source | Rule |
|---|---|---|---|
| Differentiation | 35% | Deck / one-pager | Clear, credible →100; me-too →45 |
| Defensibility / IP | 35% | Diligence | Granted IP →100; pending →70; **none on file →40** |
| Switching costs | 20% | Diligence | Contracts/lock-in →100; **missing →45** |
| Certifications | 10% | Docs | Relevant (OMRI, etc.) →100; none →55 |

### Unit economics (15%)
| Signal | Sub-wt | Source | Rule |
|---|---|---|---|
| Gross margin | 35% | Financials | ≥60% →100; 40–60 →70; <40 →40; **missing →25** |
| CAC / payback | 30% | Financials | <12mo →100; 12–24 →65; **missing →25** |
| LTV:CAC | 20% | Financials | ≥3x →100; 1–3 →55; **missing →25** |
| Contribution margin | 15% | Financials | Positive →100; **missing →30** |

> **Missing-data policy [DECIDE]:** missing signals score low *and* are tagged `unscored`. The report
> lists them under "add this data" (a fast, +points fix), separate from genuinely weak values. This is
> what makes the founder-facing "+9 / +7" actions accurate.

---

## 5. Determinism & stability *(the two properties that make this trustworthy)*

- **Determinism.** Signals are extracted once (structured reads are exact; document facts via a
  single, cached LLM extraction). The rollup is pure arithmetic. Same inputs → same score, always.
- **Stability.** Persist an **input snapshot** (hash of all signal values) with each score. The score
  only recomputes when the snapshot changes — never on a passive re-open. A founder who changes
  nothing sees the same number.
- **Versioning.** Store `model_version` (the weights + rules in effect). Historical scores stay
  reproducible; changing weights is a new version, not a silent rescore.

---

## 6. "+X points" simulation

Because the model is deterministic, the projected lift for an action is exact, not a guess:

`lift(signal → target) = score(snapshot with signal=target) − score(current snapshot)`

So "Add gross margin → +9" is computed by setting that one signal to its target band and re-running
the pure rollup. Never invent lift numbers with an LLM.

---

## 7. Outreach gate — nudge vs hard lock **[DECIDE]**

The mockups show outreach *locked* until 75. Recommendation: **soft nudge, not a hard lock.**

- Founders already published/receiving interest below 75 (e.g. Doyle at 64) shouldn't be blocked —
  that throttles your own marketplace and frustrates users.
- Instead: show the 75 goal + progress, surface sub-threshold status *to investors* (a signal, not a
  wall), and keep outreach available. Make the lock a **configurable admin setting** if you want the
  option later.

---

## 8. Admin override & score history **[DECIDE — recommended: yes]**

- Store both `ai_score` (model output) and `effective_score` (what's shown). Admin can override
  `effective_score` with a required note. (Your table already has `effective_score`.)
- Keep a **history row per computation**: score, model_version, snapshot hash, timestamp, and the
  factor breakdown — so "why did it change?" is always answerable, and overrides are audited.

---

## 9. Fairness & human-in-the-loop

An AI score that influences opportunity (matching, visibility) can encode bias. Guardrails:
- The score is **decision-support**, never an automated accept/reject.
- Admin override (§8) is the safety valve for cases the model gets wrong.
- Founder-facing language stays **forward-looking** ("here's how to improve"), never a verdict.
- Log inputs/outputs for periodic bias review across cohorts.

---

## 10. Data model

Extend `company_readiness_scores` (already holds `effective_score`):
```
company_readiness_scores
  company_id, ai_score, effective_score, band,
  model_version text, input_hash text,
  factors jsonb,        -- { team:{score, signals:[...]}, traction:{...}, ... }
  computed_at, computed_by, override_note
```
`factors` jsonb powers the breakdown, the report, and the simulation without recomputation.

---

## 11. Report generation

- Numbers (scores, contributions, lifts, benchmark) come **only** from the stored `factors` — never
  the LLM.
- An LLM writes the **prose** (verdict, per-factor narrative) *conditioned on* those numbers, so it
  can't contradict them. Deterministic report = same score, same story.

---

## 12. Build phases

1. **Model + storage** — signals, rules, weights, deterministic rollup, snapshot/versioning. Score a
   few real companies and sanity-check against your gut.
2. **Founder surfaces** — card (two scores), Investable stage (breakdown + actions + simulation).
3. **Report** — factors → PDF, LLM prose layer.
4. **Admin** — override + history; add the score to the Companies list (already built) as
   `effective_score`.
5. **Journey framing** — relabel stages to Onboard/Due-diligence/Investable/Outreach/Manage; wire the
   75 nudge.

---

## Open decisions (blockers)
1. **Missing-data policy** (§4) — confirm missing = low + "add data" tag.
2. **Gate** (§7) — nudge (recommended) or hard lock?
3. **Override + history** (§8) — confirm yes.
4. **Weights** — accept the seed weights above, or tune?
