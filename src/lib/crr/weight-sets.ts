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
export type WeightSet = {
  id: string | null;
  version: string;
  profiles: Record<ProfileKey, DimensionWeights>;
  factors: Record<FactorKey, number>;
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
export const PROFILE_LABEL: Record<ProfileKey, string> = {
  angel: "Angel",
  seed_institutional: "Seed",
  seriesA_institutional: "Series A",
  growth_institutional: "Growth",
};
export const DIMENSION_LABEL: Record<Dimension, string> = {
  narrative: "Narrative", team: "Team", financial: "Financial", traction: "Traction", capTable: "Cap table",
};
export const FACTOR_LABEL: Record<FactorKey, string> =
  Object.fromEntries(READINESS_FACTORS.map((f) => [f.key, f.label])) as Record<FactorKey, string>;
export const FACTOR_KEYS = READINESS_FACTORS.map((f) => f.key) as FactorKey[];

/** The constants as a set — the seed row, and the fallback when the table is empty. */
export const CODE_DEFAULT_SET: WeightSet = {
  id: null,
  version: "crr-profiles-v1",
  profiles: JSON.parse(JSON.stringify(PROFILES)) as Record<ProfileKey, DimensionWeights>,
  factors: Object.fromEntries(READINESS_FACTORS.map((f) => [f.key, f.max])) as Record<FactorKey, number>,
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

  for (const key of PROFILE_KEYS) {
    const w = set.profiles[key];
    if (!w) { errors.push(`${PROFILE_LABEL[key]} profile is missing.`); continue; }
    for (const d of CRR_DIMENSIONS) {
      if (!whole(w[d])) errors.push(`${PROFILE_LABEL[key]} · ${DIMENSION_LABEL[d]} must be a whole number from 0 to 100.`);
    }
    const sum = CRR_DIMENSIONS.reduce((s, d) => s + (w[d] ?? 0), 0);
    if (sum !== 100) errors.push(`${PROFILE_LABEL[key]} profile weights total ${sum} — they must total exactly 100.`);
  }

  for (const k of FACTOR_KEYS) {
    if (!whole(set.factors[k])) errors.push(`${FACTOR_LABEL[k]} must be a whole number from 0 to 100.`);
  }
  const fSum = FACTOR_KEYS.reduce((s, k) => s + (set.factors[k] ?? 0), 0);
  if (fSum !== 100) errors.push(`Factor points total ${fSum} — they must total exactly 100.`);

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

/** Every stored column a scoring row needs, computed from stored factors under a set. */
export function scoreColumnsFor(factors: Partial<Record<FactorKey, StoredFactor>>, set: WeightSet) {
  const dims = rollupWith(factors, set.factors);
  const total = totalWith(factors, set.factors);
  return {
    total_score: total,
    score_angel: scoreWith(dims, set.profiles.angel),
    score_seed_institutional: scoreWith(dims, set.profiles.seed_institutional),
    score_seriesa_institutional: scoreWith(dims, set.profiles.seriesA_institutional),
    score_growth_institutional: scoreWith(dims, set.profiles.growth_institutional),
    score_version: set.version,
    outreach_unlocked: total >= 65,
    dims,
  };
}

// ── Diff ─────────────────────────────────────────────────────────────────────

export type DiffRow = { section: string; setting: string; before: number | string; after: number | string; delta: number | null };

export function diffSets(a: WeightSet, b: WeightSet): DiffRow[] {
  const rows: DiffRow[] = [];
  for (const p of PROFILE_KEYS) {
    for (const d of CRR_DIMENSIONS) {
      const before = a.profiles[p]?.[d] ?? 0, after = b.profiles[p]?.[d] ?? 0;
      if (before !== after) rows.push({ section: `Profile · ${PROFILE_LABEL[p]}`, setting: DIMENSION_LABEL[d], before, after, delta: after - before });
    }
  }
  for (const k of FACTOR_KEYS) {
    const before = a.factors[k] ?? 0, after = b.factors[k] ?? 0;
    if (before !== after) rows.push({ section: "Factor points", setting: FACTOR_LABEL[k], before, after, delta: after - before });
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
    const nextDims = rollupWith(c.factors, candidate.factors);
    const after = scoreWith(nextDims, candidate.profiles[c.profile]);
    const prevDims = rollupWith(c.factors, current.factors);
    const bandBefore = bandForProfileWith(c.before, c.profile, prevDims.traction, current);
    const bandAfter = bandForProfileWith(after, c.profile, nextDims.traction, candidate);
    const totalAfter = totalWith(c.factors, candidate.factors);
    const gate = c.beforeTotal < 65 && totalAfter >= 65 ? "unlocks" : c.beforeTotal >= 65 && totalAfter < 65 ? "locks" : null;
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

export function fromRow(row: WeightSetRow): WeightSet {
  return {
    id: row.id,
    version: row.version,
    profiles: row.profiles as Record<ProfileKey, DimensionWeights>,
    factors: row.factors as Record<FactorKey, number>,
    bands: row.bands as Bands,
    floors: (row.floors ?? {}) as Partial<Record<ProfileKey, Floor>>,
    isActive: row.is_active,
    reason: row.reason,
    impact: (row.impact ?? null) as ImpactSnapshot | null,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}
