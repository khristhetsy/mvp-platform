/**
 * POST /api/ai/readiness-score
 *
 * Triggers Claude AI readiness scoring for a company.
 * Callable by admin/analyst roles only.
 * Result stored in company_readiness_scores — investor/admin visibility only.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiProfile } from "@/lib/api/auth";
import { scoreCompanyReadiness } from "@/lib/ai/readiness-scoring";
import { writeAuditLog } from "@/lib/data/audit";

const schema = z.object({
  companyId: z.string().uuid(),
});

export async function POST(request: Request) {
  const auth = await requireApiProfile(["admin", "analyst"]);

  if ("error" in auth) {
    return auth.error;
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "companyId (UUID) is required." }, { status: 400 });
  }

  const { companyId } = parsed.data;

  // Load company
  const { data: company, error: companyError } = await auth.supabase
    .from("companies")
    .select("id, company_name, industry, revenue_stage, funding_amount")
    .eq("id", companyId)
    .single();

  if (companyError || !company) {
    return NextResponse.json({ error: "Company not found." }, { status: 404 });
  }

  // Load documents + summaries
  const { data: documents } = await auth.supabase
    .from("documents")
    .select("document_type, ai_summary")
    .eq("company_id", companyId);

  const documentSummaries = (documents ?? [])
    .filter((d) => d.ai_summary && d.document_type)
    .map((d) => ({ type: d.document_type!, summary: d.ai_summary! }));

  const uploadedDocumentTypes = (documents ?? [])
    .flatMap((d) => (d.document_type ? [d.document_type] : []));

  // Run Claude scoring
  const result = await scoreCompanyReadiness({
    companyName: company.company_name,
    industry: company.industry,
    revenueStage: company.revenue_stage,
    fundingAmount: company.funding_amount ? Number(company.funding_amount) : null,
    documentSummaries,
    uploadedDocumentTypes,
  });

  // Don't persist demo scores — require a real API key
  if (result.isDemo) {
    const hasKey = !!process.env.ANTHROPIC_API_KEY;
    return NextResponse.json(
      {
        error: hasKey
          ? "Anthropic API call failed — check Vercel logs for details."
          : "ANTHROPIC_API_KEY is not set in Vercel environment variables.",
      },
      { status: 503 },
    );
  }

  const outreachUnlocked = result.totalScore >= 65;

  // Persist
  const { data: saved, error: saveError } = await auth.supabase
    .from("company_readiness_scores")
    .insert({
      company_id: companyId,
      total_score: result.totalScore,
      factor_scores: result.factorScores,
      scored_by: result.generatedBy,
      document_count: documentSummaries.length,
      outreach_unlocked: outreachUnlocked,
    })
    .select("id, total_score, outreach_unlocked, created_at")
    .single();

  if (saveError) {
    return NextResponse.json({ error: saveError.message }, { status: 500 });
  }

  await writeAuditLog(auth.supabase, {
    userId: auth.profile.id,
    action: "readiness_score.generated",
    entityType: "company_readiness_score",
    entityId: saved.id,
    metadata: {
      companyId,
      totalScore: result.totalScore,
      generatedBy: result.generatedBy,
      isDemo: result.isDemo,
    },
  });

  return NextResponse.json({
    id: saved.id,
    totalScore: saved.total_score,
    outreachUnlocked: saved.outreach_unlocked,
    generatedBy: result.generatedBy,
    isDemo: result.isDemo,
    createdAt: saved.created_at,
  });
}
