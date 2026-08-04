// src/lib/crr/profiles.ts
//
// Single source of truth for Capital Readiness Rating weighting. The public
// estimator and the real 13-factor engine both read profiles from here.
// No weights live anywhere else.

import { READINESS_FACTORS, type FactorKey } from "@/lib/ai/readiness-scoring";

export const CRR_DIMENSIONS = ["narrative", "team", "financial", "traction", "capTable"] as const;
export type Dimension = (typeof CRR_DIMENSIONS)[number];

/** 13 engine factors → 5 display dimensions (locked grouping). */
export const FACTOR_TO_DIMENSION: Record<FactorKey, Dimension> = {
  pitch_quality: "narrative",
  founder_team: "team",
  revenue_cashflow: "financial",
  burn_runway: "financial",
  unit_economics: "financial",
  deal_structure: "financial",
  customer_traction: "traction",
  market_evidence: "traction",
  governance_legal: "capTable",
  ip_moat: "capTable",
  exit_strategy: "capTable",
  industry_alignment: "capTable",
  impact_esg: "capTable",
};

/** Weights are integer basis points and MUST sum to 100 (see guard below). */
export type DimensionWeights = Record<Dimension, number>;

export const PROFILES = {
  angel:                 { narrative: 30, team: 30, financial: 15, traction: 15, capTable: 10 },
  seed_institutional:    { narrative: 10, team: 30, financial: 15, traction: 25, capTable: 20 },
  seriesA_institutional: { narrative: 10, team: 15, financial: 25, traction: 30, capTable: 20 },
  growth_institutional:  { narrative: 5,  team: 10, financial: 35, traction: 30, capTable: 20 },
} as const satisfies Record<string, DimensionWeights>;

export type ProfileKey = keyof typeof PROFILES;

/** Build-time guard: a profile not summing to 100 throws when this module loads
 *  (i.e. during `next build`, since server code imports it), plus the Step-8 test. */
for (const [key, w] of Object.entries(PROFILES)) {
  const sum = (Object.values(w) as number[]).reduce((a, b) => a + b, 0);
  if (sum !== 100) throw new Error(`CRR profile "${key}" weights sum to ${sum}, expected 100.`);
}

/** Investor-facing surfaces read ONE canonical institutional profile for comparability. */
export const CANONICAL_INSTITUTIONAL: ProfileKey = "seriesA_institutional";
/** Written to company_readiness_scores.score_version so historic scores stay interpretable. */
export const SCORE_VERSION = "crr-profiles-v1";

export type Band = "Strong" | "Solid" | "Developing" | "Early";
const BAND_ORDER: Band[] = ["Early", "Developing", "Solid", "Strong"];

export function bandFor(score: number): Band {
  if (score >= 75) return "Strong";
  if (score >= 60) return "Solid";
  if (score >= 40) return "Developing";
  return "Early";
}

export type FounderStage = "pre-seed" | "seed" | "series-a" | "later";

/** Pure, DB-free, unit-testable. */
export function stageToProfile(stage: FounderStage): ProfileKey {
  switch (stage) {
    case "pre-seed": return "angel";
    case "seed": return "seed_institutional";
    case "series-a": return "seriesA_institutional";
    case "later": return "growth_institutional";
  }
}

/** Institutional-only traction floor. Numeric score is never changed — only the
 *  displayed band is capped (ceiling only). Angel has no floor. */
export const TRACTION_FLOOR: Partial<Record<ProfileKey, { minTraction: number; cap: Band }>> = {
  seed_institutional: { minTraction: 20, cap: "Developing" },
  seriesA_institutional: { minTraction: 40, cap: "Developing" },
  growth_institutional: { minTraction: 40, cap: "Developing" },
};

/** Roll the 13 raw factor scores up into 5 normalized (0–100) dimension scores. */
export function rollupToDimensions(
  factors: Record<FactorKey, { pts: number; max: number }>,
): Record<Dimension, number> {
  const acc = Object.fromEntries(
    CRR_DIMENSIONS.map((d) => [d, { pts: 0, max: 0 }]),
  ) as Record<Dimension, { pts: number; max: number }>;
  for (const f of READINESS_FACTORS) {
    const d = FACTOR_TO_DIMENSION[f.key];
    acc[d].pts += factors[f.key].pts;
    acc[d].max += factors[f.key].max;
  }
  return Object.fromEntries(
    CRR_DIMENSIONS.map((d) => [d, acc[d].max > 0 ? Math.round((acc[d].pts / acc[d].max) * 100) : 0]),
  ) as Record<Dimension, number>;
}

/** Apply an audience profile's weights over the 5 dimension scores → 0–100. */
export function scoreForProfile(dims: Record<Dimension, number>, profile: ProfileKey): number {
  const w = PROFILES[profile];
  return Math.round(CRR_DIMENSIONS.reduce((s, d) => s + (dims[d] * w[d]) / 100, 0));
}

/** Band for a profile score, with the institutional traction floor applied (ceiling only). */
export function bandForProfile(score: number, profile: ProfileKey, tractionDimScore: number): Band {
  const raw = bandFor(score);
  const floor = TRACTION_FLOOR[profile];
  if (floor && tractionDimScore < floor.minTraction) {
    return BAND_ORDER.indexOf(raw) > BAND_ORDER.indexOf(floor.cap) ? floor.cap : raw;
  }
  return raw;
}
