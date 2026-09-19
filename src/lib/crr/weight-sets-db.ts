/**
 * Database side of CRR weight sets — server only.
 * Kept apart from weight-sets.ts so the arithmetic there stays pure and testable.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { FactorKey } from "@/lib/ai/readiness-scoring";
import { investorFacingScore } from "@/lib/crr/select-score";
import { stageToProfile, type ProfileKey } from "@/lib/crr/profiles";
import {
  CODE_DEFAULT_SET, fromRow, impactOf, scoreColumnsFor,
  type ImpactSnapshot, type StoredFactor, type WeightSet, type WeightSetRow,
} from "@/lib/crr/weight-sets";

const COLS = "id, version, profiles, factors, bands, floors, is_active, reason, impact, created_by, created_at";

/* eslint-disable @typescript-eslint/no-explicit-any -- Supabase generated types don't cover these new tables yet. */
type Db = SupabaseClient<any, any, any>;

/** The set currently in force. Falls back to the code constants if the table is empty or unreachable. */
export async function loadActiveSet(db: Db): Promise<WeightSet> {
  try {
    const { data } = await db.from("crr_weight_sets").select(COLS).eq("is_active", true).limit(1).maybeSingle();
    return data ? fromRow(data as WeightSetRow) : CODE_DEFAULT_SET;
  } catch {
    return CODE_DEFAULT_SET;
  }
}

export async function listSets(db: Db): Promise<WeightSet[]> {
  const { data } = await db.from("crr_weight_sets").select(COLS).order("created_at", { ascending: false });
  return ((data ?? []) as WeightSetRow[]).map(fromRow);
}

export async function getSet(db: Db, id: string): Promise<WeightSet | null> {
  const { data } = await db.from("crr_weight_sets").select(COLS).eq("id", id).maybeSingle();
  return data ? fromRow(data as WeightSetRow) : null;
}

/** Companies whose current score still carries each version stamp. */
export async function scoreCountsByVersion(db: Db): Promise<Record<string, number>> {
  const latest = await latestScores(db);
  const out: Record<string, number> = {};
  for (const row of latest) out[row.version ?? "—"] = (out[row.version ?? "—"] ?? 0) + 1;
  return out;
}

export type LatestScore = {
  id: string; companyId: string; company: string; version: string | null;
  factors: Partial<Record<FactorKey, StoredFactor>>;
  totalScore: number; investorScore: number; hasOverride: boolean; profile: ProfileKey; createdAt: string;
};

/** The newest score row per company (the table is append-only), with its company name and stage. */
export async function latestScores(db: Db): Promise<LatestScore[]> {
  const { data } = await db
    .from("company_readiness_scores")
    .select("id, company_id, total_score, factor_scores, score_version, override_score, created_at, score_angel, score_seed_institutional, score_seriesa_institutional, score_growth_institutional, effective_score")
    .order("created_at", { ascending: false });
  const rows = (data ?? []) as Array<Record<string, any>>;
  const seen = new Set<string>();
  const latest = rows.filter((r) => (seen.has(r.company_id) ? false : (seen.add(r.company_id), true)));
  if (!latest.length) return [];

  const ids = latest.map((r) => r.company_id);
  const { data: companies } = await db.from("companies").select("id, company_name, funding_stage").in("id", ids);
  const meta = new Map((companies ?? []).map((c: Record<string, any>) => [c.id, c]));

  return latest.map((r) => {
    const c = meta.get(r.company_id);
    const stage = String(c?.funding_stage ?? "").toLowerCase();
    const profile: ProfileKey = stageToProfile(
      stage.includes("pre") ? "pre-seed" : stage.includes("seed") ? "seed" : stage.includes("a") ? "series-a" : stage ? "later" : "series-a",
    );
    return {
      id: r.id as string,
      companyId: r.company_id as string,
      company: (c?.company_name as string) ?? "Unnamed company",
      version: (r.score_version as string) ?? null,
      factors: (r.factor_scores ?? {}) as Partial<Record<FactorKey, StoredFactor>>,
      totalScore: Number(r.total_score ?? 0),
      investorScore: investorFacingScore(r) ?? Number(r.total_score ?? 0),
      hasOverride: r.override_score !== null && r.override_score !== undefined,
      profile,
      createdAt: r.created_at as string,
    };
  });
}

/** What a candidate set would do to every scored company. No writes. */
export async function previewImpact(db: Db, candidate: WeightSet, current: WeightSet): Promise<ImpactSnapshot> {
  const latest = await latestScores(db);
  return impactOf(
    latest.map((c) => ({
      companyId: c.companyId, company: c.company, factors: c.factors,
      before: c.investorScore, beforeTotal: c.totalScore, hasOverride: c.hasOverride, profile: c.profile,
    })),
    candidate,
    current,
  );
}

/**
 * Re-score every company under a set — arithmetic over stored factor scores, so no
 * AI calls. Appends a row per company (the table is the timeline) carrying the
 * reason and the weight set that produced it.
 */
export async function rescoreAllUnder(db: Db, set: WeightSet, reason: string): Promise<{ updated: number; failed: number }> {
  const latest = await latestScores(db);
  let updated = 0, failed = 0;
  for (const c of latest) {
    const cols = scoreColumnsFor(c.factors, set);
    const { error } = await db.from("company_readiness_scores").insert({
      company_id: c.companyId,
      total_score: cols.total_score,
      factor_scores: c.factors,
      scored_by: "weights",
      document_count: 0,
      outreach_unlocked: cols.outreach_unlocked,
      score_angel: cols.score_angel,
      score_seed_institutional: cols.score_seed_institutional,
      score_seriesa_institutional: cols.score_seriesa_institutional,
      score_growth_institutional: cols.score_growth_institutional,
      score_version: cols.score_version,
      change_kind: "weights",
      change_reason: reason,
      weight_set_id: set.id,
    });
    if (error) failed++; else updated++;
  }
  return { updated, failed };
}

/** Save a candidate as a new version and make it active. */
export async function saveSet(
  db: Db,
  input: { version: string; profiles: WeightSet["profiles"]; factors: WeightSet["factors"]; bands: WeightSet["bands"]; floors: WeightSet["floors"]; reason: string; impact: ImpactSnapshot | null; createdBy: string },
): Promise<WeightSet> {
  await db.from("crr_weight_sets").update({ is_active: false }).eq("is_active", true);
  const { data, error } = await db.from("crr_weight_sets").insert({
    version: input.version,
    profiles: input.profiles,
    factors: input.factors,
    bands: input.bands,
    floors: input.floors,
    is_active: true,
    reason: input.reason,
    impact: input.impact,
    created_by: input.createdBy,
  }).select(COLS).single();
  if (error) throw new Error(error.message);
  return fromRow(data as WeightSetRow);
}

/** Score rows for one company, newest first — the per-company timeline. */
export async function companyScoreTimeline(db: Db, companyId: string) {
  const { data } = await db
    .from("company_readiness_scores")
    .select("id, total_score, score_seriesa_institutional, override_score, override_reason, overridden_at, change_kind, change_reason, score_version, document_count, created_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(50);
  return (data ?? []) as Array<Record<string, any>>;
}
/* eslint-enable @typescript-eslint/no-explicit-any */
