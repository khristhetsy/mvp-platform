import { createServiceRoleClient } from "@/lib/supabase/admin";

export type ReadinessBenchmark = {
  effectiveScore: number;
  percentile: number;       // 0–100, e.g. 72 = "top 28%"
  totalCompanies: number;
  stage: string | null;
  stagePercentile: number | null;  // percentile among same-stage companies
  stageCount: number | null;
};

export async function computeReadinessBenchmark(
  companyId: string,
  revenueStage: string | null,
): Promise<ReadinessBenchmark | null> {
  const admin = createServiceRoleClient();

  // Get this company's score
  const { data: own } = await admin
    .from("company_readiness_scores")
    .select("effective_score")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!own) return null;

  const myScore = own.effective_score;

  // Get all scores (for global percentile)
  const { data: all } = await admin
    .from("company_readiness_scores")
    .select("effective_score")
    .order("effective_score", { ascending: true });

  const allScores = (all ?? []).map((r) => r.effective_score);
  if (allScores.length === 0) return null;

  const globalPercentile = computePercentile(myScore, allScores);

  // Stage-relative percentile if we have a stage
  let stagePercentile: number | null = null;
  let stageCount: number | null = null;

  if (revenueStage) {
    // Get company_ids for same stage
    const { data: stageCompanies } = await admin
      .from("companies")
      .select("id")
      .eq("revenue_stage", revenueStage);

    const stageIds = (stageCompanies ?? []).map((c) => c.id);

    if (stageIds.length > 1) {
      const { data: stageScores } = await admin
        .from("company_readiness_scores")
        .select("effective_score")
        .in("company_id", stageIds);

      const stageScoreValues = (stageScores ?? []).map((r) => r.effective_score);
      if (stageScoreValues.length > 0) {
        stagePercentile = computePercentile(myScore, stageScoreValues);
        stageCount = stageScoreValues.length;
      }
    }
  }

  return {
    effectiveScore: myScore,
    percentile: globalPercentile,
    totalCompanies: allScores.length,
    stage: revenueStage,
    stagePercentile,
    stageCount,
  };
}

function computePercentile(score: number, allScores: number[]): number {
  const below = allScores.filter((s) => s < score).length;
  return Math.round((below / allScores.length) * 100);
}
