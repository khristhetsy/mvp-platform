/**
 * CRR weight sets — the weighting as data.
 *
 * The code constants in profiles.ts / readiness-scoring.ts are still the shape of
 * truth (dimension names, factor keys, the factor→dimension grouping); what moves
 * into the database is the NUMBERS: factor maxima, profile weights, bands, floors.
 * One active set at a time; saving appends a version.
 *
 * Everything here is pure except loadActiveSet / previewImpact, so the arithmetic
 * is unit-testable without a database.
 */
import { READINESS_FACTORS, type FactorKey } from "@/lib/ai/readiness-scoring";
import {
  CRR_DIMENSIONS, FACTOR_TO_DIMENSION, PROFILES, TRACTION_FLOOR,
  type Band, type Dimension, type DimensionWeights, type ProfileKey,
} from "@/lib/crr/profiles";

export type Bands = { strong: number; solid: number; developing: number };
export type Floor = { minTraction: number; cap: Band };
/** The thirteen maxima for one stage. Must total exactly 100. */
export type FactorPoints = Record<FactorKey, number>;

export type WeightSet = {
  id: string | null;
  version: string;
  /**
   * DERIVED, not edited. Each stage's dimension shares are the sum of its
   * factor points, so the two can no longer disagree. Kept on the type because
   * saved history rows carry it and the diff/impact code reads it.
   */
  profiles: Record<ProfileKey, DimensionWeights>;
  /** The single driver: thirteen maxima per stage, each set totalling 100. */
  factors: Record<ProfileKey, FactorPoints>;
  bands: Bands;
  floors: Partial<Record<ProfileKey, Floor>>;
  isActive: boolean;
  reason: string | null;
  createdBy: string | null;
  createdByName?: string | null;
  createdAt: string | null;
  impact?: ImpactSnapshot | null;
};

export const PROFILE_KEYS = Object.keys(PROFILES) as ProfileKey[];
/**
 * Display names only. The KEYS never change: `angel` is the name of a database
 * column (score_angel), it is written into every saved weight-set version, and
 * it is stamped on every historical score row — renaming it would mean a
 * migration plus rewriting history. Renaming the label costs one line.
 */
export const PROFILE_LABEL: Record<ProfileKey, string> = {
  angel: "Pre-seed",
  seed_institutional: "Seed",
  seriesA_institutional: "Series A",
  growth_institutional: "Growth",
};
/** Which round each profile is for — shown on the Weights tab so the four tabs
 *  read as real cohorts rather than abstract presets. */
export const PROFILE_ROUND: Record<ProfileKey, string> = {
  angel: "Angel round — friends & family, angels, pre-seed funds",
  seed_institutional: "Seed round — institutional seed funds",
  seriesA_institutional: "Series A round",
  growth_institutional: "Expansion, Series B or Series C",
};
export const DIMENSION_LABEL: Record<Dimension, string> = {
  narrative: "Narrative", team: "Team", financial: "Financial", traction: "Traction", capTable: "Cap table",
};
export const FACTOR_LABEL: Record<FactorKey, string> =
  Object.fromEntries(READINESS_FACTORS.map((f) => [f.key, f.label])) as Record<FactorKey, string>;
export const FACTOR_KEYS = READINESS_FACTORS.map((f) => f.key) as FactorKey[];

/** The original flat maxima — the shape of the engine, and the base for apportionment. */
export const BASE_FACTOR_MAX: FactorPoints =
  Object.fromEntries(READINESS_FACTORS.map((f) => [f.key, f.max])) as FactorPoints;

/**
 * Turn one stage's dimension weights into thirteen factor maxima.
 *
 * Each dimension's weight becomes the number of raw points its factors share,
 * split in proportion to the engine's original maxima and rounded by largest
 * remainder so the dimension lands on its weight EXACTLY. Do this for all four
 * stages and each set totals 100, because the weights do.
 *
 * This is how "factor points drive, dimensions follow" is seeded without
 * changing what any stage emphasises: on day one every dimension's share is
 * identical to the weight it used to carry.
 */
export function apportionFactors(weights: DimensionWeights, base: FactorPoints = BASE_FACTOR_MAX): FactorPoints {
  const out = Object.fromEntries(FACTOR_KEYS.map((k) => [k, 0])) as FactorPoints;

  for (const d of CRR_DIMENSIONS) {
    const keys = FACTOR_KEYS.filter((k) => FACTOR_TO_DIMENSION[k] === d);
    const target = Math.max(0, Math.round(weights[d] ?? 0));
    if (!keys.length || target === 0) continue;

    const baseSum = keys.reduce((s, k) => s + (base[k] ?? 0), 0);
    // A dimension whose factors all have a zero base splits its points evenly.
    const shares = keys.map((k) => (baseSum > 0 ? ((base[k] ?? 0) / baseSum) * target : target / keys.length));

    const floors = shares.map((x) => Math.floor(x));
    let left = target - floors.reduce((a, b) => a + b, 0);
    // Largest remainder: hand the leftovers to the biggest fractional parts.
    const order = shares
      .map((x, i) => ({ i, frac: x - Math.floor(x) }))
      .sort((a, b) => b.frac - a.frac || a.i - b.i);
    const give = new Array(keys.length).fill(0) as number[];
    for (let n = 0; n < order.length && left > 0; n++, left--) give[order[n].i] = 1;

    keys.forEach((k, i) => { out[k] = floors[i] + give[i]; });
  }
  return out;
}

/** Each stage's factor points, apportioned from the code profile weights. */
export function apportionAll(profiles: Record<ProfileKey, DimensionWeights>, base: FactorPoints = BASE_FACTOR_MAX): Record<ProfileKey, FactorPoints> {
  return Object.fromEntries(
    (Object.keys(profiles) as ProfileKey[]).map((p) => [p, apportionFactors(profiles[p], base)]),
  ) as Record<ProfileKey, FactorPoints>;
}

/** What each dimension is worth under one stage's points — the read-only row. */
export function dimensionShares(points: FactorPoints): DimensionWeights {
  const out = Object.fromEntries(CRR_DIMENSIONS.map((d) => [d, 0])) as DimensionWeights;
  for (const k of FACTOR_KEYS) out[FACTOR_TO_DIMENSION[k]] += points[k] ?? 0;
  return out;
}

/** The derived weights for every stage — what `profiles` now holds. */
export function sharesForAll(factors: Record<ProfileKey, FactorPoints>): Record<ProfileKey, DimensionWeights> {
  return Object.fromEntries(
    (Object.keys(factors) as ProfileKey[]).map((p) => [p, dimensionShares(factors[p])]),
  ) as Record<ProfileKey, DimensionWeights>;
}

/** The constants as a set — the seed row, and the fallback when the table is empty. */
const DEFAULT_FACTORS = apportionAll(PROFILES as unknown as Record<ProfileKey, DimensionWeights>);

export const CODE_DEFAULT_SET: WeightSet = {
  id: null,
  version: "crr-profiles-v1",
  profiles: sharesForAll(DEFAULT_FACTORS),
  factors: DEFAULT_FACTORS,
  bands: { strong: 75, solid: 60, developing: 40 },
  floors: JSON.parse(JSON.stringify(TRACTION_FLOOR)) as Partial<Record<ProfileKey, Floor>>,
  isActive: true,
  reason: "Code defaults",
  createdBy: null,
  createdAt: null,
};

// ── Validation ───────────────────────────────────────────────────────────────

/** Every rule the UI enforces and the API re-checks. Empty array = saveable. */
export function validateSet(set: Pick<WeightSet, "profiles" | "factors" | "bands" | "floors">): string[] {
  const errors: string[] = [];
  const whole = (n: unknown) => typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 100;

  // Factor points are the only thing edited now. Four sets, each totalling 100.
  for (const key of PROFILE_KEYS) {
    const points = set.factors[key];
    if (!points) { errors.push(`${PROFILE_LABEL[key]} factor points are missing.`); continue; }
    for (const k of FACTOR_KEYS) {
      if (!whole(points[k])) errors.push(`${PROFILE_LABEL[key]} · ${FACTOR_LABEL[k]} must be a whole number from 0 to 100.`);
    }
    const sum = FACTOR_KEYS.reduce((s, k) => s + (points[k] ?? 0), 0);
    if (sum !== 100) errors.push(`${PROFILE_LABEL[key]} factor points total ${sum} — they must total exactly 100.`);
  }

  const { strong, solid, developing } = set.bands;
  if (![strong, solid, developing].every(whole)) errors.push("Band thresholds must be whole numbers from 0 to 100.");
  else if (!(strong > solid && solid > developing)) errors.push("Bands must descend: Strong above Solid above Developing.");

  for (const [key, floor] of Object.entries(set.floors) as Array<[ProfileKey, Floor | undefined]>) {
    if (!floor) continue;
    if (!whole(floor.minTraction)) errors.push(`${PROFILE_LABEL[key]} traction floor must be a whole number from 0 to 100.`);
  }
  return errors;
}

// ── Scoring with a set ───────────────────────────────────────────────────────

export type StoredFactor = { pts: number; max: number };

/**
 * Roll stored factor scores into the five dimensions under a set's factor maxima.
 *
 * Each factor contributes its achievement RATIO (pts ÷ the max it was scored
 * against) weighted by the set's max, so re-weighting never needs the AI to run
 * again, and with unchanged maxima this is identical to the original rollup.
 */
export function rollupWith(
  factors: Partial<Record<FactorKey, StoredFactor>>,
  factorMax: Record<FactorKey, number>,
): Record<Dimension, number> {
  const acc = Object.fromEntries(CRR_DIMENSIONS.map((d) => [d, { pts: 0, max: 0 }])) as Record<Dimension, { pts: number; max: number }>;
  for (const key of FACTOR_KEYS) {
    const stored = factors[key];
    const max = factorMax[key] ?? 0;
    if (!stored || max <= 0) continue;
    const ratio = stored.max > 0 ? stored.pts / stored.max : 0;
    const d = FACTOR_TO_DIMENSION[key];
    acc[d].pts += ratio * max;
    acc[d].max += max;
  }
  return Object.fromEntries(
    CRR_DIMENSIONS.map((d) => [d, acc[d].max > 0 ? Math.round((acc[d].pts / acc[d].max) * 100) : 0]),
  ) as Record<Dimension, number>;
}

/** Total out of 100 under a set's factor maxima (what `total_score` holds). */
export function totalWith(
  factors: Partial<Record<FactorKey, StoredFactor>>,
  factorMax: Record<FactorKey, number>,
): number {
  let pts = 0;
  for (const key of FACTOR_KEYS) {
    const stored = factors[key];
    const max = factorMax[key] ?? 0;
    if (!stored || max <= 0) continue;
    pts += (stored.max > 0 ? stored.pts / stored.max : 0) * max;
  }
  return Math.round(pts);
}

export function scoreWith(dims: Record<Dimension, number>, weights: DimensionWeights): number {
  return Math.round(CRR_DIMENSIONS.reduce((s, d) => s + (dims[d] * (weights[d] ?? 0)) / 100, 0));
}

const BAND_ORDER: Band[] = ["Early", "Developing", "Solid", "Strong"];
export function bandWith(score: number, bands: Bands): Band {
  if (score >= bands.strong) return "Strong";
  if (score >= bands.solid) return "Solid";
  if (score >= bands.developing) return "Developing";
  return "Early";
}
/** Band with the profile's traction floor applied — a ceiling on the band only, never on the number. */
export function bandForProfileWith(score: number, profile: ProfileKey, tractionDim: number, set: Pick<WeightSet, "bands" | "floors">): Band {
  const raw = bandWith(score, set.bands);
  const floor = set.floors[profile];
  if (floor && tractionDim < floor.minTraction) {
    return BAND_ORDER.indexOf(raw) > BAND_ORDER.indexOf(floor.cap) ? floor.cap : raw;
  }
  return raw;
}

/** The outreach gate. Read against the company's OWN stage, not a stage-neutral total. */
export const OUTREACH_GATE = 65;

/**
 * Every stored column a scoring row needs.
 *
 * One score per stage, each computed directly from that stage's own factor
 * maxima — there is no normalise-then-reweight step any more, so a factor's
 * influence is exactly its points.
 *
 * `total_score` is the score under the company's OWN stage, and the gate reads
 * it. A pre-seed company is no longer measured against a rubric weighted toward
 * revenue it cannot have.
 */
export function scoreColumnsFor(
  factors: Partial<Record<FactorKey, StoredFactor>>,
  set: WeightSet,
  profile: ProfileKey = "seriesA_institutional",
) {
  const own = set.factors[profile] ?? set.factors.seriesA_institutional;
  const total = totalWith(factors, own);
  return {
    total_score: total,
    score_angel: totalWith(factors, set.factors.angel),
    score_seed_institutional: totalWith(factors, set.factors.seed_institutional),
    score_seriesa_institutional: totalWith(factors, set.factors.seriesA_institutional),
    score_growth_institutional: totalWith(factors, set.factors.growth_institutional),
    score_version: set.version,
    outreach_unlocked: total >= OUTREACH_GATE,
    dims: rollupWith(factors, own),
  };
}

/** One stage's score, straight from its own points. */
export function scoreUnder(factors: Partial<Record<FactorKey, StoredFactor>>, set: WeightSet, profile: ProfileKey): number {
  return totalWith(factors, set.factors[profile] ?? set.factors.seriesA_institutional);
}

// ── Diff ─────────────────────────────────────────────────────────────────────

export type DiffRow = { section: string; setting: string; before: number | string; after: number | string; delta: number | null };

export function diffSets(a: WeightSet, b: WeightSet): DiffRow[] {
  const rows: DiffRow[] = [];
  for (const p of PROFILE_KEYS) {
    for (const k of FACTOR_KEYS) {
      const before = a.factors[p]?.[k] ?? 0, after = b.factors[p]?.[k] ?? 0;
      if (before !== after) rows.push({ section: `${PROFILE_LABEL[p]} · factor points`, setting: FACTOR_LABEL[k], before, after, delta: after - before });
    }
    // Dimension shares are derived, but they are how a human reads the change.
    const sa = dimensionShares(a.factors[p] ?? ({} as FactorPoints));
    const sb = dimensionShares(b.factors[p] ?? ({} as FactorPoints));
    for (const d of CRR_DIMENSIONS) {
      if (sa[d] !== sb[d]) rows.push({ section: `${PROFILE_LABEL[p]} · dimension share`, setting: DIMENSION_LABEL[d], before: sa[d], after: sb[d], delta: sb[d] - sa[d] });
    }
  }
  for (const key of ["strong", "solid", "developing"] as const) {
    const before = a.bands[key], after = b.bands[key];
    if (before !== after) rows.push({ section: "Bands", setting: key[0].toUpperCase() + key.slice(1), before, after, delta: after - before });
  }
  for (const p of PROFILE_KEYS) {
    const before = a.floors[p]?.minTraction ?? 0, after = b.floors[p]?.minTraction ?? 0;
    if (before !== after) rows.push({ section: "Traction floors", setting: PROFILE_LABEL[p], before, after, delta: after - before });
  }
  return rows;
}

/** One-line summary for the history list ("Series A · Team 15→10, Traction 30→35"). */
export function summarizeDiff(rows: DiffRow[]): string {
  if (!rows.length) return "No numeric change";
  const bySection = new Map<string, string[]>();
  for (const r of rows) bySection.set(r.section, [...(bySection.get(r.section) ?? []), `${r.setting} ${r.before}→${r.after}`]);
  return [...bySection.entries()].map(([s, items]) => `${s}: ${items.join(", ")}`).join(" · ");
}

// ── Impact ───────────────────────────────────────────────────────────────────

export type ImpactRow = {
  companyId: string; company: string;
  before: number; after: number; delta: number;
  bandBefore: Band; bandAfter: Band;
  gate: "unlocks" | "locks" | null;
  hasOverride: boolean;
};
export type ImpactSnapshot = {
  rows: ImpactRow[];
  companies: number; avgBefore: number; avgAfter: number;
  bandChanges: number; gateUnlocks: number; gateLocks: number;
};

/** Recompute every scored company under a candidate set. Arithmetic only — no AI, no writes. */
export function impactOf(
  latest: Array<{ companyId: string; company: string; factors: Partial<Record<FactorKey, StoredFactor>>; before: number; hasOverride: boolean; profile: ProfileKey; beforeTotal: number }>,
  candidate: WeightSet,
  current: WeightSet,
): ImpactSnapshot {
  const rows: ImpactRow[] = latest.map((c) => {
    // Every company is re-scored under ITS OWN stage's points, before and after.
    const nextPoints = candidate.factors[c.profile] ?? candidate.factors.seriesA_institutional;
    const prevPoints = current.factors[c.profile] ?? current.factors.seriesA_institutional;
    const nextDims = rollupWith(c.factors, nextPoints);
    const after = totalWith(c.factors, nextPoints);
    const prevDims = rollupWith(c.factors, prevPoints);
    const bandBefore = bandForProfileWith(c.before, c.profile, prevDims.traction, current);
    const bandAfter = bandForProfileWith(after, c.profile, nextDims.traction, candidate);
    // The gate now reads the same stage score, so it moves with it.
    const totalAfter = after;
    const gate = c.beforeTotal < OUTREACH_GATE && totalAfter >= OUTREACH_GATE ? "unlocks" : c.beforeTotal >= OUTREACH_GATE && totalAfter < OUTREACH_GATE ? "locks" : null;
    return { companyId: c.companyId, company: c.company, before: c.before, after, delta: after - c.before, bandBefore, bandAfter, gate, hasOverride: c.hasOverride };
  });
  const avg = (ns: number[]) => (ns.length ? Math.round(ns.reduce((a, b) => a + b, 0) / ns.length) : 0);
  return {
    rows: rows.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)),
    companies: rows.length,
    avgBefore: avg(rows.map((r) => r.before)),
    avgAfter: avg(rows.map((r) => r.after)),
    bandChanges: rows.filter((r) => r.bandBefore !== r.bandAfter).length,
    gateUnlocks: rows.filter((r) => r.gate === "unlocks").length,
    gateLocks: rows.filter((r) => r.gate === "locks").length,
  };
}

/** Next version name in the family: crr-profiles-v2 → crr-profiles-v3. */
export function nextVersionName(current: string, taken: string[]): string {
  const m = /^(.*?)(\d+)$/.exec(current);
  const stem = m ? m[1] : `${current}-v`;
  let n = m ? Number(m[2]) + 1 : 2;
  while (taken.includes(`${stem}${n}`)) n++;
  return `${stem}${n}`;
}

// ── Row mapping ──────────────────────────────────────────────────────────────

export type WeightSetRow = {
  id: string; version: string; profiles: unknown; factors: unknown; bands: unknown; floors: unknown;
  is_active: boolean; reason: string | null; impact: unknown; created_by: string | null; created_at: string;
};

/**
 * Saved rows come in two shapes. Versions written before factor points became
 * per-stage hold one flat set of thirteen; those are apportioned forward using
 * the weights that were saved alongside them, so History stays readable and an
 * old version can still be reverted to.
 */
export function factorsFromStored(storedFactors: unknown, storedProfiles: unknown): Record<ProfileKey, FactorPoints> {
  const raw = (storedFactors ?? {}) as Record<string, unknown>;
  const perStage = PROFILE_KEYS.every((p) => raw[p] && typeof raw[p] === "object");
  if (perStage) return raw as Record<ProfileKey, FactorPoints>;

  const flat = { ...BASE_FACTOR_MAX, ...(raw as Partial<FactorPoints>) } as FactorPoints;
  const weights = (storedProfiles ?? {}) as Partial<Record<ProfileKey, DimensionWeights>>;
  return Object.fromEntries(
    PROFILE_KEYS.map((p) => [p, apportionFactors(weights[p] ?? dimensionShares(flat), flat)]),
  ) as Record<ProfileKey, FactorPoints>;
}

export function fromRow(row: WeightSetRow): WeightSet {
  const factors = factorsFromStored(row.factors, row.profiles);
  return {
    id: row.id,
    version: row.version,
    profiles: sharesForAll(factors),
    factors,
    bands: row.bands as Bands,
    floors: (row.floors ?? {}) as Partial<Record<ProfileKey, Floor>>,
    isActive: row.is_active,
    reason: row.reason,
    impact: (row.impact ?? null) as ImpactSnapshot | null,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}
