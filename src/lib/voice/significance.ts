// A/B significance for the booked-demo rate. Pure functions (unit-tested) so the
// "95% ✓" badge means something: a two-proportion z-test of the leading variant
// against the pooled rest. Low-volume variants can't win — a minimum sample
// guards against calling noise a result.

/** Minimum calls a variant needs before it can be declared a significant leader. */
export const MIN_SAMPLE = 30;

export interface VariantStat {
  variantId: string | null;
  calls: number;
  booked: number;
}

export interface SignificanceResult {
  /** The leading variant by booked rate (with enough sample), or null. */
  leaderId: string | null;
  /** Two-sided confidence (%) the leader differs from the rest; null if untestable. */
  confidence: number | null;
  /** True when confidence ≥ 95% — the threshold the badge uses. */
  significant: boolean;
}

/** Standard normal CDF (Abramowitz & Stegun 7.1.26 approximation). */
export function normalCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

/** Two-sided confidence (%) that two booked rates genuinely differ. */
export function twoProportionConfidence(aBooked: number, aCalls: number, bBooked: number, bCalls: number): number | null {
  if (aCalls === 0 || bCalls === 0) return null;
  const p1 = aBooked / aCalls;
  const p2 = bBooked / bCalls;
  const pooled = (aBooked + bBooked) / (aCalls + bCalls);
  if (pooled === 0 || pooled === 1) return null;
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / aCalls + 1 / bCalls));
  if (se === 0) return null;
  const z = Math.abs((p1 - p2) / se);
  return Math.round((2 * normalCdf(z) - 1) * 1000) / 10; // %
}

/** Rank variants, test the leader vs the pooled rest, and return the verdict. */
export function variantSignificance(variants: VariantStat[]): SignificanceResult {
  const eligible = variants.filter((v) => v.calls >= MIN_SAMPLE);
  if (eligible.length < 2) return { leaderId: null, confidence: null, significant: false };

  const rate = (v: VariantStat) => v.booked / v.calls;
  const leader = [...eligible].sort((a, b) => rate(b) - rate(a))[0];
  const rest = eligible.filter((v) => v !== leader);
  const restBooked = rest.reduce((s, v) => s + v.booked, 0);
  const restCalls = rest.reduce((s, v) => s + v.calls, 0);

  const confidence = twoProportionConfidence(leader.booked, leader.calls, restBooked, restCalls);
  return {
    leaderId: leader.variantId,
    confidence,
    significant: confidence !== null && confidence >= 95,
  };
}
