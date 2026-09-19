// Recompute and persist a company's Capital Readiness score. Shared by the
// admin route, the upload trigger, and the backfill job. Mirrors the logic in
// /api/ai/readiness-score (single source: src/lib/crr/profiles.ts for weights).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { scoreCompanyReadiness } from "@/lib/ai/readiness-scoring";
import { loadActiveSet } from "@/lib/crr/weight-sets-db";
import { scoreColumnsFor } from "@/lib/crr/weight-sets";

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
    .eq("company_id", companyId)
    .neq("status", "archived");

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

  // Weighting comes from the active weight set (admin-editable), not constants.
  const set = await loadActiveSet(supabase);
  const cols = scoreColumnsFor(result.factorScores, set);

  const { error } = await supabase.from("company_readiness_scores").insert({
    company_id: companyId,
    total_score: cols.total_score,
    factor_scores: result.factorScores,
    scored_by: result.generatedBy,
    document_count: documentSummaries.length,
    outreach_unlocked: cols.outreach_unlocked,
    score_angel: cols.score_angel,
    score_seed_institutional: cols.score_seed_institutional,
    score_seriesa_institutional: cols.score_seriesa_institutional,
    score_growth_institutional: cols.score_growth_institutional,
    score_version: cols.score_version,
    change_kind: "rescored",
    weight_set_id: set.id,
  } as never);
  if (error) return { ok: false, reason: error.message };

  return { ok: true, totalScore: cols.total_score };
}
