import { NextResponse } from "next/server";
import { requireRole } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { getCompanyPledgeSummary, getFounderPledgeCompanyId } from "@/lib/data/investor-pledges";
import { claudeComplete, isClaudeConfigured, CLAUDE_SONNET } from "@/lib/claude";

export const dynamic = "force-dynamic";

export type RoundHealthRecommendation = {
  priority: "high" | "medium" | "low";
  title: string;
  action: string;
  metric?: string;
};

export type RoundHealthAdvisorResult = {
  healthGrade: "A" | "B" | "C" | "D";
  healthLabel: string;
  summary: string;
  recommendations: RoundHealthRecommendation[];
  source: "claude" | "fallback";
};

const SYSTEM_PROMPT = `You are a seasoned venture capital advisor coaching an early-stage startup founder through their fundraise.

Analyze the founder's round data and return a JSON health assessment with specific, actionable recommendations.

Return ONLY this JSON object (no markdown, no extra text):
{
  "healthGrade": "A|B|C|D",
  "healthLabel": "one-line grade description (e.g. 'On track — strong momentum')",
  "summary": "2-3 sentence honest assessment of where the round stands and the biggest lever to pull right now",
  "recommendations": [
    {
      "priority": "high|medium|low",
      "title": "short imperative title (5-8 words)",
      "action": "specific concrete next action (1-2 sentences)",
      "metric": "optional: the specific metric this recommendation targets"
    }
  ]
}

Grade rubric:
- A: Fill ≥ 70%, good pipeline velocity, investor engagement high
- B: Fill 30-70%, steady progress, some pipeline activity
- C: Fill < 30%, low engagement or slow pipeline, needs intervention
- D: Fill 0% or no activity, raise at risk

Rules:
- Give exactly 3-4 recommendations
- Be specific — reference the actual numbers from the data
- Recommendations must be actionable today, not generic advice
- Priority "high" = do this week; "medium" = this month; "low" = ongoing
- Return ONLY valid JSON`;

function fallbackResult(
  fillPct: number,
  totalPledged: number,
  fundingTarget: number | null,
  interestedCount: number,
  pendingIntros: number,
  totalPipeline: number,
): RoundHealthAdvisorResult {
  let healthGrade: "A" | "B" | "C" | "D";
  let healthLabel: string;

  if (fillPct >= 70) {
    healthGrade = "A";
    healthLabel = "On track — strong momentum";
  } else if (fillPct >= 30) {
    healthGrade = "B";
    healthLabel = "Good progress — keep momentum";
  } else if (fillPct > 0 || interestedCount > 0) {
    healthGrade = "C";
    healthLabel = "Needs attention — accelerate pipeline";
  } else {
    healthGrade = "D";
    healthLabel = "At risk — immediate action needed";
  }

  const targetStr = fundingTarget
    ? `$${fundingTarget.toLocaleString()}`
    : "your target";

  const recommendations: RoundHealthRecommendation[] = [];

  if (fillPct < 50) {
    recommendations.push({
      priority: "high",
      title: "Expand your active investor pipeline",
      action: `You are ${fillPct}% to ${targetStr}. Add at least 10 new qualified investors to your pipeline this week using the Investor Matching tool.`,
      metric: `Current fill: ${fillPct}%`,
    });
  }

  if (pendingIntros > 0) {
    recommendations.push({
      priority: "high",
      title: "Follow up on pending intro requests",
      action: `You have ${pendingIntros} pending intro request${pendingIntros !== 1 ? "s" : ""} — check your notifications and respond promptly to keep investor interest warm.`,
      metric: `${pendingIntros} pending intro${pendingIntros !== 1 ? "s" : ""}`,
    });
  }

  if (interestedCount > 0 && totalPledged === 0) {
    recommendations.push({
      priority: "high",
      title: "Convert interest to pledge commitments",
      action: `${interestedCount} investor${interestedCount !== 1 ? "s" : ""} expressed interest but no pledges recorded. Send them your one-pager and set up intro calls this week.`,
      metric: `${interestedCount} interested, $0 pledged`,
    });
  }

  if (totalPipeline < 15) {
    recommendations.push({
      priority: "medium",
      title: "Import and track more investors",
      action: "Add contacts from your network to the Investor Pipeline so you have a structured view of every conversation. Aim for 20+ tracked relationships.",
      metric: `Current pipeline: ${totalPipeline} investors`,
    });
  }

  recommendations.push({
    priority: "low",
    title: "Publish a company update to re-engage investors",
    action: "Post a milestone update to keep saved investors warm. Companies that post monthly updates close rounds 30% faster on average.",
  });

  return {
    healthGrade,
    healthLabel,
    summary: `Your round is ${fillPct}% funded with ${interestedCount} interested investors and ${totalPipeline} tracked relationships. ${healthGrade === "A" ? "You are on track — focus on converting interest to commitments." : healthGrade === "B" ? "Progress is steady but there are clear levers to accelerate." : "Your raise needs intervention. Prioritize expanding outreach and converting existing interest."}`,
    recommendations: recommendations.slice(0, 4),
    source: "fallback",
  };
}

export async function GET() {
  let profile;
  try {
    profile = await requireRole(["founder"]);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createServiceRoleClient();
  const company = await ensureFounderCompanyForUser(profile);
  if (!company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  // Load round stats in parallel
  const [pledgeCompanyId, pipelineResult, interestResult, introResult] = await Promise.all([
    getFounderPledgeCompanyId(admin, profile.id, company.id),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any)
      .from("pipeline_investors")
      .select("outreach_status, interested")
      .eq("founder_id", profile.id) as Promise<{ data: Array<{ outreach_status: string | null; interested: boolean | null }> | null }>,
    admin.from("investor_interests").select("id", { count: "exact", head: true }).eq("company_id", company.id),
    admin.from("intro_requests").select("id", { count: "exact", head: true }).eq("company_id", company.id).in("status", ["requested", "reviewing"]),
  ]);

  const pledge = await getCompanyPledgeSummary(admin, pledgeCompanyId);
  const pipelineRows = pipelineResult.data ?? [];

  const pipeline = { not_started: 0, contacted: 0, in_progress: 0, closed: 0 };
  let interestedCount = 0;
  for (const row of pipelineRows) {
    const s = row.outreach_status as keyof typeof pipeline | null;
    if (s && s in pipeline) pipeline[s]++;
    if (row.interested) interestedCount++;
  }

  const fundingTarget = company.funding_amount ? Number(company.funding_amount) : null;
  const fillPct = fundingTarget && fundingTarget > 0
    ? Math.min(100, Math.round((pledge.totalPledged / fundingTarget) * 100))
    : 0;
  const totalPipeline = pipelineRows.length;
  const pendingIntros = introResult.count ?? 0;

  // Days since published
  const publishedAt = (company as unknown as { published_at?: string | null }).published_at;
  const daysSincePublish = publishedAt
    ? Math.floor((Date.now() - new Date(publishedAt).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  if (!isClaudeConfigured()) {
    return NextResponse.json(
      fallbackResult(fillPct, pledge.totalPledged, fundingTarget, interestedCount, pendingIntros, totalPipeline),
    );
  }

  const context = [
    `Company: ${company.company_name ?? "Startup"}`,
    company.industry ? `Industry: ${company.industry}` : null,
    company.revenue_stage ? `Stage: ${company.revenue_stage}` : null,
    fundingTarget ? `Funding target: $${fundingTarget.toLocaleString()}` : "No funding target set",
    `Amount pledged so far: $${pledge.totalPledged.toLocaleString()} (${fillPct}% of target)`,
    `Investors who pledged: ${pledge.investorCount}`,
    `Investors who expressed interest: ${interestResult.count ?? 0}`,
    `Pipeline size (founder-tracked investors): ${totalPipeline}`,
    `  - Not started: ${pipeline.not_started}`,
    `  - Contacted: ${pipeline.contacted}`,
    `  - In progress: ${pipeline.in_progress}`,
    `  - Closed: ${pipeline.closed}`,
    `Interested from pipeline: ${interestedCount}`,
    `Pending intro requests: ${pendingIntros}`,
    daysSincePublish != null ? `Days since company published: ${daysSincePublish}` : "Company not yet published",
    company.is_published ? "Status: Published on marketplace" : "Status: Not yet published",
  ].filter(Boolean).join("\n");

  const userMessage = `Analyze this startup founder's fundraising situation and provide a health assessment:\n\n${context}`;

  try {
    const raw = await claudeComplete(
      [{ role: "user", content: userMessage }],
      { model: CLAUDE_SONNET, maxTokens: 700, system: SYSTEM_PROMPT },
    );

    const cleaned = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    const result = JSON.parse(cleaned) as RoundHealthAdvisorResult;
    return NextResponse.json({ ...result, source: "claude" });
  } catch (err) {
    console.error("Round health advisor AI error:", err);
    return NextResponse.json(
      fallbackResult(fillPct, pledge.totalPledged, fundingTarget, interestedCount, pendingIntros, totalPipeline),
    );
  }
}
