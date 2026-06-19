import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { getAdminCompanyWorkspace } from "@/lib/admin/company-workspace";
import { claudeComplete, isClaudeConfigured, CLAUDE_SONNET } from "@/lib/claude";

export const dynamic = "force-dynamic";

export type AIAssessmentRecommendation = "approve" | "request_changes" | "decline";

export type AIAssessmentResult = {
  recommendation: AIAssessmentRecommendation;
  headline: string;
  strengths: string[];
  concerns: string[];
  dataGaps: string[];
  source: "claude" | "fallback";
};

const SYSTEM_PROMPT = `You are a senior venture platform analyst reviewing whether a company should be approved for marketplace listing on CapitalOS.

Given a company's profile, readiness score, documents status, and investor activity, provide a concise review assessment.

Return ONLY this JSON (no markdown, no extra text):
{
  "recommendation": "approve|request_changes|decline",
  "headline": "1 sentence capturing the single most important finding for this decision",
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "concerns": ["concern 1", "concern 2"],
  "dataGaps": ["missing item 1", "missing item 2"]
}

Rules:
- "approve": score ≥70, key documents present, no critical compliance issues
- "request_changes": promising but incomplete — missing docs, low score, or fixable gaps
- "decline": fundamental issues (score <30, no pitch deck, critical compliance flags)
- strengths: 3 items max — specific positives from the data provided
- concerns: 2 items max — most important blockers or risks
- dataGaps: specific documents or fields that are missing but needed for a full review
- Be concise and actionable — this is for an admin making a real decision
- Return ONLY valid JSON`;

function fallbackAssessment(
  readinessScore: number | null,
  missingDocs: string[],
  hasPitchDeck: boolean,
  complianceCritical: number,
): AIAssessmentResult {
  const score = readinessScore ?? 0;

  let recommendation: AIAssessmentRecommendation = "request_changes";
  if (score >= 70 && hasPitchDeck && complianceCritical === 0) {
    recommendation = "approve";
  } else if (score < 30 || !hasPitchDeck) {
    recommendation = "decline";
  }

  const strengths: string[] = [];
  const concerns: string[] = [];
  const dataGaps: string[] = [];

  if (score >= 70) strengths.push(`Strong readiness score of ${score}%`);
  if (hasPitchDeck) strengths.push("Pitch deck present");
  if (score >= 50 && score < 70) strengths.push(`Moderate readiness score of ${score}% — approaching listing threshold`);
  if (strengths.length === 0) strengths.push("Company onboarding initiated");

  if (score < 70) concerns.push(`Readiness score (${score}%) is below the 70% listing threshold`);
  if (!hasPitchDeck) concerns.push("Pitch deck not yet uploaded — required for marketplace listing");
  if (complianceCritical > 0) concerns.push(`${complianceCritical} critical compliance issue(s) outstanding`);

  if (missingDocs.length > 0) {
    dataGaps.push(...missingDocs.slice(0, 3));
  }
  if (dataGaps.length === 0 && recommendation !== "approve") {
    dataGaps.push("Run AI diligence report for full document analysis");
  }

  const headlineMap: Record<AIAssessmentRecommendation, string> = {
    approve: `Company meets marketplace listing criteria — ready for approval.`,
    request_changes: `Company needs ${score < 50 ? "significant work" : "a few improvements"} before marketplace listing.`,
    decline: `Company does not meet minimum listing requirements at this stage.`,
  };

  return {
    recommendation,
    headline: headlineMap[recommendation],
    strengths: strengths.slice(0, 3),
    concerns: concerns.slice(0, 2),
    dataGaps: dataGaps.slice(0, 3),
    source: "fallback",
  };
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ companyId: string }> },
) {
  try {
    await requireRole(["admin", "analyst"]);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { companyId } = await params;

  let workspace;
  try {
    workspace = await getAdminCompanyWorkspace(companyId);
  } catch {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  if (!workspace) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  const { company, readiness, documents, compliance, investorActivity } = workspace;

  // Fallback if Claude not configured
  if (!isClaudeConfigured()) {
    return NextResponse.json(
      fallbackAssessment(
        readiness.latestScore,
        documents.missingRequiredHints,
        documents.pitchDeckPresent,
        compliance.criticalCount,
      ),
    );
  }

  const context = [
    `Company: ${company.company_name}`,
    company.industry ? `Industry: ${company.industry}` : null,
    company.is_published ? "Status: Currently published on marketplace" : "Status: Not yet published",
    `Review status: ${company.review_status ?? "not reviewed"}`,
    "",
    `Readiness score: ${readiness.latestScore !== null ? `${readiness.latestScore}%` : "not generated"}`,
    `Onboarding complete: ${readiness.onboardingPercent}%`,
    `Milestone: ${readiness.milestoneLabel}`,
    readiness.remediation.open > 0
      ? `Open remediation tasks: ${readiness.remediation.open} (${readiness.remediation.highPriorityOpen} high priority)`
      : "No open remediation tasks",
    "",
    `Documents uploaded: ${documents.totalCount}`,
    `Pitch deck present: ${documents.pitchDeckPresent ? "Yes" : "No"}`,
    documents.missingRequiredHints.length > 0
      ? `Missing documents: ${documents.missingRequiredHints.slice(0, 5).join(", ")}`
      : "No missing required documents flagged",
    "",
    `Compliance: ${compliance.openCount} open events (${compliance.criticalCount} critical, ${compliance.highCount} high)`,
    "",
    `Investor signals: ${investorActivity.savedDeals} saves, ${investorActivity.interests} interests, ${investorActivity.introRequests} intro requests`,
    investorActivity.pledgeTotal > 0 ? `Indicative pledge total: $${investorActivity.pledgeTotal.toLocaleString()}` : null,
  ].filter(Boolean).join("\n");

  try {
    const raw = await claudeComplete(
      [{ role: "user", content: `Review this company for marketplace listing approval:\n\n${context}` }],
      { model: CLAUDE_SONNET, maxTokens: 500, system: SYSTEM_PROMPT },
    );

    const cleaned = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    const result = JSON.parse(cleaned) as AIAssessmentResult;
    return NextResponse.json({ ...result, source: "claude" });
  } catch (err) {
    console.error("Admin AI assessment error:", err);
    return NextResponse.json(
      fallbackAssessment(
        readiness.latestScore,
        documents.missingRequiredHints,
        documents.pitchDeckPresent,
        compliance.criticalCount,
      ),
    );
  }
}
