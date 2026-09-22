/**
 * The Capital Readiness Rating — one reader, one source, for the whole platform.
 *
 * Before this there were three numbers all calling themselves readiness:
 *   · the 13-factor engine, stored on company_readiness_scores (the real one)
 *   · computeInvestableCrr — 0.6×readiness + 0.3×profile + 5 + 5
 *   · computeReadinessScore — max(55, 90 − missingDocs×6), a document-type count
 * The last two never touched a factor, a dimension or a weight, so re-scoring and
 * re-weighting could not move them. They are retired; this is what replaces them.
 *
 * The score is the company's OWN stage column, the same number the Weights tab
 * tunes and the outreach gate reads. Server only.
 */
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { stageToProfile, type Band, type Dimension, type ProfileKey } from "@/lib/crr/profiles";
import { normalizeFundingStage } from "@/lib/crr/select-score";
import { loadActiveSet } from "@/lib/crr/weight-sets-db";
import {
  OUTREACH_GATE, PROFILE_LABEL, bandForProfileWith, rollupWith, totalWith,
  type StoredFactor,
} from "@/lib/crr/weight-sets";
import { dimensionCards, type DimensionCard } from "@/lib/crr/dimension-detail";
import { DIMENSION_LABEL, FACTOR_KEYS, FACTOR_LABEL } from "@/lib/crr/weight-sets";
import { FACTOR_TO_DIMENSION } from "@/lib/crr/profiles";
import type { FactorGap } from "@/lib/crr/improvement";
import type { FactorKey, FactorScore } from "@/lib/ai/readiness-scoring";

export { OUTREACH_GATE };

export type Crr = {
  /** 0–100 under the company's own stage, or null when never scored. */
  score: number | null;
  /** An admin override replaces the score wherever one is set. */
  isOverridden: boolean;
  band: Band | null;
  profile: ProfileKey;
  profileLabel: string;
  /** The engine's own gate — never a hard-coded threshold on a page. */
  outreachUnlocked: boolean;
  gate: number;
  /** How far off the gate, 0 when already through. */
  pointsToGate: number;
  dimensions: DimensionCard[];
  dims: Record<Dimension, number> | null;
  factorScores: Partial<Record<FactorKey, FactorScore>>;
  scoredAt: string | null;
  version: string | null;
  /** Newest last — the preparation trend. */
  history: Array<{ score: number; at: string }>;
  /** Supporting figures. They feed the score; they are no longer the score. */
  documentCount: number;
  /**
   * Per-factor points earned and available at this company's stage — what the
   * improvement wizard ranks. Already in CRR points, so a gap of 11 is 11
   * points of the score.
   */
  factorGaps: FactorGap[];
};

const EMPTY = (profile: ProfileKey): Crr => ({
  score: null,
  isOverridden: false,
  band: null,
  profile,
  profileLabel: PROFILE_LABEL[profile],
  outreachUnlocked: false,
  gate: OUTREACH_GATE,
  pointsToGate: OUTREACH_GATE,
  dimensions: [],
  dims: null,
  factorScores: {},
  scoredAt: null,
  version: null,
  history: [],
  documentCount: 0,
  factorGaps: [],
});

/**
 * The CRR for one company. Returns a null score rather than a zero when the
 * company has never been scored — "not scored" is a different claim from
 * "scored zero", and a founder should not be shown a 0 they did not earn.
 */
export async function crrFor(companyId: string | null | undefined): Promise<Crr> {
  if (!companyId) return EMPTY("seriesA_institutional");
  const db = createServiceRoleClient();

  // funding_stage is on the table (migration 20260803002) but not in the
  // generated types — same cast the rest of the CRR code uses.
  const { data: companyRow } = await db
    .from("companies").select("funding_stage").eq("id", companyId).maybeSingle();
  const profile = stageToProfile(
    normalizeFundingStage((companyRow as unknown as { funding_stage?: string | null } | null)?.funding_stage),
  );

  // Append-only table: newest row per company is the current score, and the
  // rest is the preparation trend.
  const { data } = await db
    .from("company_readiness_scores")
    // The stage columns are on the table (migration 20260804001) but not in the
    // generated types; we recompute from factor_scores anyway, so they are not selected.
    .select("total_score, effective_score, override_score, factor_scores, score_version, document_count, outreach_unlocked, created_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  const rows = (data ?? []) as unknown as Array<Record<string, unknown>>;
  if (!rows.length) return EMPTY(profile);

  const latest = rows[0];
  const set = await loadActiveSet(db);
  const factorScores = (latest.factor_scores ?? {}) as Partial<Record<FactorKey, FactorScore>>;
  const stored = factorScores as Partial<Record<FactorKey, StoredFactor>>;
  const points = set.factors[profile] ?? set.factors.seriesA_institutional;

  // Recompute from the stored factors under the ACTIVE weighting, so a weight
  // change is reflected before the next re-score writes a row.
  const computed = totalWith(stored, points);
  const override = typeof latest.override_score === "number" ? latest.override_score : null;
  const score = override ?? computed;

  const dims = rollupWith(stored, points);
  const unlocked = score >= OUTREACH_GATE;

  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

  return {
    score,
    isOverridden: override !== null,
    band: bandForProfileWith(score, profile, dims.traction, set),
    profile,
    profileLabel: PROFILE_LABEL[profile],
    outreachUnlocked: unlocked,
    gate: OUTREACH_GATE,
    pointsToGate: Math.max(0, OUTREACH_GATE - score),
    dimensions: dimensionCards(stored, set, profile),
    dims,
    factorScores,
    scoredAt: (latest.created_at as string) ?? null,
    version: (latest.score_version as string) ?? null,
    history: rows
      .map((r) => ({ score: num(r.override_score) ?? num(r.total_score) ?? 0, at: r.created_at as string }))
      .reverse(),
    documentCount: num(latest.document_count) ?? 0,
    factorGaps: FACTOR_KEYS.map((key) => {
      const max = points[key] ?? 0;
      const f = stored[key];
      // The factor was scored against its own maximum, which may differ from
      // this stage's; the achievement ratio is what carries across.
      const ratio = f && f.max > 0 ? Math.min(1, Math.max(0, f.pts / f.max)) : 0;
      return {
        key,
        label: FACTOR_LABEL[key],
        pts: Math.round(ratio * max * 10) / 10,
        max,
        dimension: DIMENSION_LABEL[FACTOR_TO_DIMENSION[key]],
      };
    }),
  };
}

/**
 * Engine scores for many companies at once — one query, not N.
 *
 * For list surfaces and the matcher, which need a score per company and would
 * otherwise round-trip per row. Companies with no score row are absent from the
 * map rather than present as 0.
 */
export async function crrScoresFor(companyIds: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const ids = [...new Set(companyIds.filter(Boolean))];
  if (!ids.length) return out;

  const db = createServiceRoleClient();
  const { data } = await db
    .from("company_readiness_scores")
    .select("company_id, total_score, override_score, created_at")
    .in("company_id", ids)
    .order("created_at", { ascending: false });

  // Newest row per company wins; the table is append-only.
  for (const r of ((data ?? []) as unknown as Array<Record<string, unknown>>)) {
    const id = String(r.company_id);
    if (out.has(id)) continue;
    const override = typeof r.override_score === "number" ? r.override_score : null;
    const total = typeof r.total_score === "number" ? r.total_score : null;
    const score = override ?? total;
    if (score !== null) out.set(id, score);
  }
  return out;
}
