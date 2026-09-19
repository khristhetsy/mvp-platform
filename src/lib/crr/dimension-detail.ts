/**
 * What one dimension is worth for one company — the arithmetic behind the
 * dimension cards on /admin/readiness and the detail panel behind them.
 *
 * Every number here is COMPUTED. The AI writes the sentence that goes next to a
 * gain; it never supplies the gain itself, because a plausible-looking invented
 * number is worse than no number at all.
 *
 * Pure and DB-free, so the maths is unit-testable without a database or an API key.
 */
import { FACTOR_TO_DIMENSION, CRR_DIMENSIONS, type Dimension, type ProfileKey } from "@/lib/crr/profiles";
import {
  DIMENSION_LABEL, FACTOR_KEYS, FACTOR_LABEL, rollupWith, scoreWith,
  type StoredFactor, type WeightSet,
} from "@/lib/crr/weight-sets";
import type { FactorKey } from "@/lib/ai/readiness-scoring";

/** Which factors roll into which dimension, under the active set's maxima. */
export function factorsIn(dimension: Dimension): FactorKey[] {
  return FACTOR_KEYS.filter((k) => FACTOR_TO_DIMENSION[k] === dimension);
}

export type FactorRow = {
  key: FactorKey;
  label: string;
  pts: number;
  max: number;
  /** 0–1. */
  ratio: number;
};

export type DimensionCard = {
  key: Dimension;
  label: string;
  /** 0–100 — the rolled-up dimension score. */
  score: number;
  /** This dimension's weight under the company's own stage profile. */
  weight: number;
  /** Points of the company's profile score this dimension currently supplies. */
  contributes: number;
  /** Points still on the table if it reached 100. */
  headroom: number;
};

/** The five cards for one company's row. */
export function dimensionCards(
  factors: Partial<Record<FactorKey, StoredFactor>>,
  set: WeightSet,
  profile: ProfileKey,
): DimensionCard[] {
  const dims = rollupWith(factors, set.factors);
  const weights = set.profiles[profile] ?? set.profiles.seriesA_institutional;
  return CRR_DIMENSIONS.map((d) => {
    const score = dims[d] ?? 0;
    const weight = weights?.[d] ?? 0;
    return {
      key: d,
      label: DIMENSION_LABEL[d],
      score,
      weight,
      contributes: round1((score * weight) / 100),
      headroom: round1(((100 - score) * weight) / 100),
    };
  });
}

export type DimensionDetail = DimensionCard & {
  factors: FactorRow[];
  /** Raw points earned / available across the factors inside this dimension. */
  pts: number;
  ptsMax: number;
  /** The company's profile score as it stands, and if this dimension reached `target`. */
  scoreNow: number;
  target: number;
  scoreAtTarget: number;
  gainAtTarget: number;
};

/**
 * One dimension, opened. `target` is the "if it hit N" figure the panel shows —
 * 60 by default, which is the Solid band, i.e. the first threshold worth aiming at.
 */
export function dimensionDetail(
  dimension: Dimension,
  factors: Partial<Record<FactorKey, StoredFactor>>,
  set: WeightSet,
  profile: ProfileKey,
  target = 60,
): DimensionDetail {
  const cards = dimensionCards(factors, set, profile);
  const card = cards.find((c) => c.key === dimension)!;
  const dims = rollupWith(factors, set.factors);
  const weights = set.profiles[profile] ?? set.profiles.seriesA_institutional;

  const rows: FactorRow[] = factorsIn(dimension).map((key) => {
    const stored = factors[key];
    const max = set.factors[key] ?? 0;
    // Stored points are rescaled to the active maxima, the same way rollupWith does
    // it, so the rows always add up to the dimension score above them.
    const ratio = stored && stored.max > 0 ? stored.pts / stored.max : 0;
    return { key, label: FACTOR_LABEL[key], pts: round1(ratio * max), max, ratio };
  });

  const scoreNow = scoreWith(dims, weights);
  const lifted = { ...dims, [dimension]: Math.max(dims[dimension] ?? 0, target) };
  const scoreAtTarget = scoreWith(lifted, weights);

  return {
    ...card,
    factors: rows,
    pts: round1(rows.reduce((s, r) => s + r.pts, 0)),
    ptsMax: rows.reduce((s, r) => s + r.max, 0),
    scoreNow,
    target,
    scoreAtTarget,
    gainAtTarget: scoreAtTarget - scoreNow,
  };
}

export type Gap = {
  key: FactorKey;
  label: string;
  pts: number;
  max: number;
  /** Points of the company's profile score that are lost because this factor
   *  is not full marks — what makes one gap worth more than another. */
  lost: number;
};

/**
 * The factors inside a dimension, worst first, measured in points of the
 * company's own profile score rather than raw factor points. A 3-point deal-terms
 * gap in a heavily-weighted dimension can outrank a 10-point market gap in a
 * light one, which is the whole reason for weighting by stage.
 */
export function rankedGaps(
  dimension: Dimension,
  factors: Partial<Record<FactorKey, StoredFactor>>,
  set: WeightSet,
  profile: ProfileKey,
): Gap[] {
  const weights = set.profiles[profile] ?? set.profiles.seriesA_institutional;
  const weight = weights?.[dimension] ?? 0;
  const rows = factorsIn(dimension);
  const dimMax = rows.reduce((s, k) => s + (set.factors[k] ?? 0), 0);
  if (dimMax <= 0) return [];

  return rows
    .map((key) => {
      const stored = factors[key];
      const max = set.factors[key] ?? 0;
      const ratio = stored && stored.max > 0 ? stored.pts / stored.max : 0;
      const missing = (1 - ratio) * max; // raw factor points not earned
      return {
        key,
        label: FACTOR_LABEL[key],
        pts: round1(ratio * max),
        max,
        lost: round1((missing / dimMax) * weight),
      };
    })
    .sort((a, b) => b.lost - a.lost);
}

/** Gaps across every dimension, worst first — used to rank the row's weak spots. */
export function allGaps(
  factors: Partial<Record<FactorKey, StoredFactor>>,
  set: WeightSet,
  profile: ProfileKey,
): Gap[] {
  return CRR_DIMENSIONS.flatMap((d) => rankedGaps(d, factors, set, profile)).sort((a, b) => b.lost - a.lost);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
