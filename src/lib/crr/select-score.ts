// Read-side helpers for the CRR audience profiles (see ./profiles.ts).
//
// Deploy-order safe: before the 20260804001 migration adds the score_* columns,
// these fall back to effective_score / total_score, so behaviour is unchanged.
// After the migration + the next scoring run populate the columns, founder
// surfaces read their stage-matched profile and investor surfaces read the one
// canonical (Series A) profile. An explicit admin override always wins.

import {
  CANONICAL_INSTITUTIONAL,
  stageToProfile,
  type FounderStage,
  type ProfileKey,
} from "./profiles";

const PROFILE_COLUMN: Record<ProfileKey, string> = {
  angel: "score_angel",
  seed_institutional: "score_seed_institutional",
  seriesA_institutional: "score_seriesa_institutional",
  growth_institutional: "score_growth_institutional",
};

/** Normalize free-text companies.funding_stage into one of the 4 canonical stages. */
export function normalizeFundingStage(raw: string | null | undefined): FounderStage {
  const s = (raw ?? "").toLowerCase().replace(/[\s_]+/g, "-");
  if (!s) return "seed";
  if (s.includes("pre-seed") || s.includes("preseed") || s.includes("idea") || s.includes("angel")) {
    return "pre-seed";
  }
  if (
    s.includes("series-b") ||
    s.includes("series-c") ||
    s.includes("series-d") ||
    s.includes("growth") ||
    s.includes("later") ||
    s.includes("expansion") ||
    s.includes("mezzanine") ||
    s.includes("bridge") ||
    s.includes("pre-ipo")
  ) {
    return "later";
  }
  if (s.includes("series-a") || s === "a") return "series-a";
  if (s.includes("seed")) return "seed";
  return "seed";
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

type ScoreRow = Record<string, unknown> | null | undefined;

/** Shared: override wins, then the requested profile column, then the raw score. */
function pickScore(row: NonNullable<ScoreRow>, column: string): number | null {
  const override = num(row.override_score);
  if (override !== null) return override;
  return num(row[column]) ?? num(row.effective_score) ?? num(row.total_score) ?? null;
}

/** Founder-facing CRR: the score under the founder's own stage profile. */
export function founderFacingScore(row: ScoreRow, fundingStage: string | null | undefined): number | null {
  if (!row) return null;
  const profile = stageToProfile(normalizeFundingStage(fundingStage));
  return pickScore(row, PROFILE_COLUMN[profile]);
}

/** Investor-facing CRR: one canonical (Series A) profile for comparability. */
export function investorFacingScore(row: ScoreRow): number | null {
  if (!row) return null;
  return pickScore(row, PROFILE_COLUMN[CANONICAL_INSTITUTIONAL]);
}
