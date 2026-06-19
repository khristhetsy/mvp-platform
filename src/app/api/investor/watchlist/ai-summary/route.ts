import { NextResponse } from "next/server";
import { requireInvestorWorkspaceSession } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { claudeComplete, isClaudeConfigured, CLAUDE_SONNET } from "@/lib/claude";

export const dynamic = "force-dynamic";

export type WatchlistCompany = {
  companyId: string;
  companyName: string;
  industry: string | null;
  stage: string | null;
};

export type CompanyInsight = {
  companyId: string;
  alignmentScore: number;
  alignmentLabel: "Strong fit" | "Moderate fit" | "Weak fit";
  reasoning: string;
};

export type WatchlistAISummaryResult = {
  topPicks: string[];
  missingSegments: string[];
  thesisCoverage: string;
  insights: CompanyInsight[];
  source: "claude" | "fallback";
};

const SYSTEM_PROMPT = `You are an investment analyst assessing how well a watchlist of companies aligns with an investor's stated thesis.

Return ONLY this JSON (no markdown, no extra text):
{
  "topPicks": ["companyId1", "companyId2"],
  "missingSegments": ["gap description 1", "gap description 2"],
  "thesisCoverage": "1-2 sentence summary of watchlist coverage vs. thesis",
  "insights": [
    { "companyId": "id", "alignmentScore": 85, "alignmentLabel": "Strong fit", "reasoning": "one sentence" }
  ]
}

Rules:
- alignmentScore: 0-100 based on how well company industry/stage matches the thesis
- alignmentLabel: "Strong fit" (≥70), "Moderate fit" (40-69), "Weak fit" (<40)
- topPicks: up to 3 companyIds with strongest thesis alignment (use exact IDs from input)
- missingSegments: 1-2 gaps — sectors or stages the thesis requires but the watchlist lacks
- Be specific and actionable
- Return ONLY valid JSON`;

function fallbackSummary(companies: WatchlistCompany[]): WatchlistAISummaryResult {
  const insights: CompanyInsight[] = companies.map((c) => ({
    companyId: c.companyId,
    alignmentScore: 60,
    alignmentLabel: "Moderate fit",
    reasoning: `${c.companyName} is in the ${c.industry ?? "unspecified"} sector at ${c.stage ?? "an unspecified"} stage.`,
  }));

  return {
    topPicks: companies.slice(0, 3).map((c) => c.companyId),
    missingSegments: ["Add ANTHROPIC_API_KEY for personalized thesis analysis"],
    thesisCoverage: "Algorithmic assessment — configure AI for thesis-aligned scoring.",
    insights,
    source: "fallback",
  };
}

export async function POST(request: Request) {
  let investorId: string;
  try {
    const session = await requireInvestorWorkspaceSession();
    investorId = session.investorId;
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { companies?: WatchlistCompany[] };
  try {
    body = await request.json() as { companies?: WatchlistCompany[] };
  } catch {
    body = {};
  }

  const companies = body.companies ?? [];

  if (companies.length === 0) {
    return NextResponse.json({
      topPicks: [],
      missingSegments: [],
      thesisCoverage: "Add companies to your watchlist to see thesis alignment.",
      insights: [],
      source: "fallback",
    } satisfies WatchlistAISummaryResult);
  }

  // Load investor profile for thesis context
  const admin = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const profileResult = await (admin as any)
    .from("investor_profiles")
    .select(
      "investor_type, investment_thesis, preferred_sectors, preferred_stages, preferred_geographies, check_size_min, check_size_max",
    )
    .eq("id", investorId)
    .maybeSingle();
  const investorProfile = (profileResult as { data: Record<string, unknown> | null }).data;

  if (!isClaudeConfigured()) {
    return NextResponse.json(fallbackSummary(companies));
  }

  const thesisLines = [
    investorProfile?.investment_thesis
      ? `Investment thesis: ${String(investorProfile.investment_thesis)}`
      : null,
    Array.isArray(investorProfile?.preferred_sectors) &&
    (investorProfile.preferred_sectors as string[]).length > 0
      ? `Preferred sectors: ${(investorProfile.preferred_sectors as string[]).join(", ")}`
      : null,
    Array.isArray(investorProfile?.preferred_stages) &&
    (investorProfile.preferred_stages as string[]).length > 0
      ? `Preferred stages: ${(investorProfile.preferred_stages as string[]).join(", ")}`
      : null,
    Array.isArray(investorProfile?.preferred_geographies) &&
    (investorProfile.preferred_geographies as string[]).length > 0
      ? `Preferred geographies: ${(investorProfile.preferred_geographies as string[]).join(", ")}`
      : null,
    investorProfile?.check_size_min ?? investorProfile?.check_size_max
      ? `Check size: $${((investorProfile?.check_size_min as number) ?? 0).toLocaleString()} – $${((investorProfile?.check_size_max as number) ?? 0).toLocaleString()}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  const companiesList = companies
    .map(
      (c) =>
        `- ID: ${c.companyId} | Name: ${c.companyName} | Industry: ${c.industry ?? "unknown"} | Stage: ${c.stage ?? "unknown"}`,
    )
    .join("\n");

  const prompt = `Investor thesis:\n${thesisLines || "No thesis configured — assess based on general investment potential."}\n\nWatchlist companies (${companies.length} total):\n${companiesList}`;

  try {
    const raw = await claudeComplete(
      [{ role: "user", content: prompt }],
      { model: CLAUDE_SONNET, maxTokens: 900, system: SYSTEM_PROMPT },
    );
    const cleaned = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    const parsed = JSON.parse(cleaned) as WatchlistAISummaryResult;
    return NextResponse.json({ ...parsed, source: "claude" });
  } catch (err) {
    console.error("Watchlist AI summary error:", err);
    return NextResponse.json(fallbackSummary(companies));
  }
}
