import type { SupabaseClient } from "@supabase/supabase-js";
import { generateDiligenceReport } from "@/lib/ai";

// Shared diligence-report generation used by both the staff route
// (POST /api/ai/reports) and the founder self-serve route
// (POST /api/founder/report/generate), so the two can never drift.

export type ReportSection = { title: string; body: string };

export function findSectionBody(sections: ReportSection[], keywords: string[]): string {
  const section = sections.find((item) => {
    const title = item.title.toLowerCase();
    return keywords.some((keyword) => title.includes(keyword));
  });
  return section?.body ?? "";
}

/** Milliseconds a company must wait between self-serve generations. */
export const FOUNDER_REPORT_COOLDOWN_MS = 24 * 60 * 60 * 1000;

/**
 * How long until this company may generate again, based on the most recent
 * report actually stored. DB-backed rather than in-memory, so it survives
 * serverless cold starts — the in-memory limiter only guards bursts.
 */
export async function msUntilNextAllowedGeneration(
  db: SupabaseClient,
  companyId: string,
  cooldownMs: number = FOUNDER_REPORT_COOLDOWN_MS,
): Promise<number> {
  const { data } = await db
    .from("diligence_reports")
    .select("created_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data?.created_at) return 0;
  const elapsed = Date.now() - new Date(data.created_at as string).getTime();
  return Math.max(0, cooldownMs - elapsed);
}

export type GeneratedReportResult = {
  report: Record<string, unknown>;
  generation: { generatedBy: string; isDemo: boolean; readinessScoreAvailable: boolean };
};

/**
 * Build a diligence report from the company's document summaries and persist it.
 * `db` must be able to read the company/documents and insert into
 * diligence_reports — pass a service-role client for founder-initiated runs.
 */
export async function generateAndSaveDiligenceReport(
  db: SupabaseClient,
  companyId: string,
): Promise<GeneratedReportResult> {
  const { data: company, error: companyError } = await db
    .from("companies")
    .select("*")
    .eq("id", companyId)
    .single();

  if (companyError || !company) {
    throw new Error("Company not found.");
  }

  const { data: documents } = await db
    .from("documents")
    .select("document_type, ai_summary")
    .eq("company_id", companyId);

  const report = await generateDiligenceReport({
    companyName: company.company_name,
    documentSummaries:
      documents?.flatMap((d) => (d.ai_summary ? [d.ai_summary as string] : [])) ?? [],
    uploadedDocumentTypes:
      documents?.flatMap((d) => (d.document_type ? [d.document_type as string] : [])) ?? [],
  });

  const { data: savedReport, error: reportError } = await db
    .from("diligence_reports")
    .insert({
      company_id: companyId,
      executive_summary: report.executiveSummary,
      business_overview: findSectionBody(report.sections, ["business", "overview"]),
      financial_review: findSectionBody(report.sections, ["financial", "finance"]),
      market_review: findSectionBody(report.sections, ["market", "competition"]),
      legal_review: findSectionBody(report.sections, ["legal", "compliance"]),
      team_review: findSectionBody(report.sections, ["team", "founder"]),
      risk_flags: report.riskFlags,
      missing_documents: report.missingDocuments,
      readiness_score: report.readinessScore,
      recommendations: report.recommendedNextSteps.join("\n"),
    })
    .select("*")
    .single();

  if (reportError) {
    throw new Error(reportError.message);
  }

  return {
    report: savedReport as Record<string, unknown>,
    generation: {
      generatedBy: report.generatedBy,
      isDemo: report.isDemo,
      readinessScoreAvailable: report.readinessScore !== null,
    },
  };
}
