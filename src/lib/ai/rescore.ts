// Recompute and persist a company's Capital Readiness score. Shared by the
// admin route, the upload trigger, and the backfill job. Mirrors the logic in
// /api/ai/readiness-score (single source: src/lib/crr/profiles.ts for weights).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { scoreCompanyReadiness } from "@/lib/ai/readiness-scoring";
import { rollupToDimensions, scoreForProfile, SCORE_VERSION } from "@/lib/crr/profiles";

export type RescoreResult = { ok: boolean; totalScore?: number; reason?: string };

export async function rescoreCompanyReadiness(
  supabase: SupabaseClient<Database>,
  companyId: string,
): Promise<RescoreResult> {
  const { data: company } = await supabase
    .from("companies")
    .select("id, company_name, industry, revenue_stage, funding_amount")
    .eq("id", companyId)
    .maybeSingle();
  if (!company) return { ok: false, reason: "company_not_found" };

  const { data: documents } = await supabase
    .from("documents")
    .select("document_type, ai_summary")
    .eq("company_id", companyId);

  const documentSummaries = (documents ?? [])
    .filter((d) => d.ai_summary && d.document_type)
    .map((d) => ({ type: d.document_type as string, summary: d.ai_summary as string }));
  const uploadedDocumentTypes = (documents ?? []).flatMap((d) => (d.document_type ? [d.document_type] : []));

  const result = await scoreCompanyReadiness({
    companyName: company.company_name,
    industry: company.industry,
    revenueStage: company.revenue_stage,
    fundingAmount: company.funding_amount ? Number(company.funding_amount) : null,
    documentSummaries,
    uploadedDocumentTypes,
  });
  if (result.isDemo) return { ok: false, reason: "demo" };

  const dims = rollupToDimensions(result.factorScores);
  const profileScores = {
    score_angel: scoreForProfile(dims, "angel"),
    score_seed_institutional: scoreForProfile(dims, "seed_institutional"),
    score_seriesa_institutional: scoreForProfile(dims, "seriesA_institutional"),
    score_growth_institutional: scoreForProfile(dims, "growth_institutional"),
    score_version: SCORE_VERSION,
  };

  const { error } = await supabase.from("company_readiness_scores").insert({
    company_id: companyId,
    total_score: result.totalScore,
    factor_scores: result.factorScores,
    scored_by: result.generatedBy,
    document_count: documentSummaries.length,
    outreach_unlocked: result.totalScore >= 65,
    ...profileScores,
  } as never);
  if (error) return { ok: false, reason: error.message };

  return { ok: true, totalScore: result.totalScore };
}
