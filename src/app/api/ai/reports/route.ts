import { NextResponse } from "next/server";
import { requireApiProfile } from "@/lib/api/auth";
import { generateDiligenceReport } from "@/lib/ai";
import { writeAuditLog } from "@/lib/data/audit";
import { diligenceReportCreateSchema } from "@/lib/validation";

type ReportSection = {
  title: string;
  body: string;
};

function findSectionBody(sections: ReportSection[], keywords: string[]) {
  const section = sections.find((item) => {
    const title = item.title.toLowerCase();

    return keywords.some((keyword) => title.includes(keyword));
  });

  return section?.body ?? "";
}

export async function POST(request: Request) {
  const auth = await requireApiProfile(["admin", "analyst"]);

  if ("error" in auth) {
    return auth.error;
  }

  const body = await request.json().catch(() => null);
  const parsed = diligenceReportCreateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid diligence report request." }, { status: 400 });
  }

  const { data: company, error: companyError } = await auth.supabase
    .from("companies")
    .select("*")
    .eq("id", parsed.data.companyId)
    .single();

  if (companyError || !company) {
    return NextResponse.json({ error: "Company not found." }, { status: 404 });
  }

  const { data: documents } = await auth.supabase
    .from("documents")
    .select("document_type, ai_summary")
    .eq("company_id", parsed.data.companyId);

  const report = await generateDiligenceReport({
    companyName: company.company_name,
    documentSummaries: documents?.flatMap((document) => (document.ai_summary ? [document.ai_summary] : [])) ?? [],
    uploadedDocumentTypes:
      documents?.flatMap((document) => (document.document_type ? [document.document_type] : [])) ?? [],
  });

  const { data: savedReport, error: reportError } = await auth.supabase
    .from("diligence_reports")
    .insert({
      company_id: parsed.data.companyId,
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
    return NextResponse.json({ error: reportError.message }, { status: 400 });
  }

  await writeAuditLog(auth.supabase, {
    userId: auth.profile.id,
    action: "diligence_report.created",
    entityType: "diligence_report",
    entityId: savedReport.id,
    metadata: { companyId: parsed.data.companyId },
  });

  return NextResponse.json({
    report: savedReport,
    generation: {
      generatedBy: report.generatedBy,
      isDemo: report.isDemo,
      readinessScoreAvailable: report.readinessScore !== null,
    },
  });
}
