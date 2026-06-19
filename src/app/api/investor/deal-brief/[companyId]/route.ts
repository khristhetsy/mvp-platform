import { NextResponse } from "next/server";
import { requireInvestorWorkspaceSession } from "@/lib/supabase/auth";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { claudeComplete, isClaudeConfigured, CLAUDE_SONNET } from "@/lib/claude";

export const dynamic = "force-dynamic";

export type DealBriefResult = {
  thesisMatch: "strong" | "partial" | "weak";
  thesisMatchLabel: string;
  headline: string;
  whyItFits: string[];
  watchOuts: string[];
  source: "claude" | "fallback";
};

const SYSTEM_PROMPT = `You are an experienced venture capital analyst preparing a personalized deal brief for an investor.

Given an investor's thesis/preferences and a company profile, write a concise thesis-fit brief.

Return ONLY this JSON object (no markdown, no extra text):
{
  "thesisMatch": "strong|partial|weak",
  "thesisMatchLabel": "one-line match summary (e.g. 'Strong thesis fit — sector and stage aligned')",
  "headline": "1-sentence headline capturing the most compelling thing about this company for THIS investor",
  "whyItFits": ["reason 1", "reason 2", "reason 3"],
  "watchOuts": ["concern 1", "concern 2"]
}

Rules:
- Be specific to THIS investor's stated thesis and preferences
- whyItFits: 3 items, each 1-2 sentences, referencing actual investor prefs and company data
- watchOuts: 2 items max — honest concerns an investor with this thesis would have
- thesisMatch "strong" = 3+ direct alignment points; "partial" = 1-2 alignment points; "weak" = little overlap
- Return ONLY valid JSON`;

function fallbackResult(
  companyName: string,
  industry: string | null,
  stage: string | null,
  investorSectors: string[],
  investorStages: string[],
): DealBriefResult {
  const sectorMatch = investorSectors.length === 0 || (industry && investorSectors.some(
    (s) => industry.toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes(industry.toLowerCase()),
  ));
  const stageMatch = investorStages.length === 0 || (stage && investorStages.some(
    (s) => stage.toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes(stage.toLowerCase()),
  ));

  const matchScore = [sectorMatch, stageMatch].filter(Boolean).length;
  const thesisMatch: "strong" | "partial" | "weak" =
    matchScore >= 2 ? "strong" : matchScore === 1 ? "partial" : "weak";

  return {
    thesisMatch,
    thesisMatchLabel:
      thesisMatch === "strong"
        ? "Strong thesis fit — sector and stage aligned"
        : thesisMatch === "partial"
          ? "Partial fit — some thesis alignment"
          : "Limited overlap with stated preferences",
    headline: `${companyName} is a ${[stage, industry].filter(Boolean).join(" ")} company${investorSectors.length ? ` operating in ${investorSectors[0]}` : ""}.`,
    whyItFits: [
      sectorMatch
        ? `Sector alignment: ${companyName}'s ${industry ?? "industry"} maps to your stated focus areas.`
        : `Consider whether ${companyName}'s sector aligns with your current portfolio strategy.`,
      stageMatch
        ? `Stage fit: The company is at ${stage ?? "this stage"}, which matches your preferred investment stages.`
        : `Note: the company's stage may differ from your stated preferences — verify this fits your fund mandate.`,
      `The company has a published marketplace profile with a CapitalOS readiness score — review the diligence report below for details.`,
    ],
    watchOuts: [
      "AI-powered brief not available (add ANTHROPIC_API_KEY). Review the company profile manually to assess thesis fit.",
      "Verify funding terms, cap table structure, and founder backgrounds during diligence.",
    ],
    source: "fallback",
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ companyId: string }> },
) {
  let session;
  try {
    session = await requireInvestorWorkspaceSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { companyId } = await params;
  const { investorId } = session;
  const admin = createServiceRoleClient();

  // Load investor profile and company data in parallel
  // Cast companies query: some columns (state, country, business_description) may not be
  // reflected in generated types yet.
  type CompanyRow = {
    company_name: string | null;
    industry: string | null;
    revenue_stage: string | null;
    state: string | null;
    country: string | null;
    business_description: string | null;
    funding_amount: number | string | null;
  };

  const [investorRes, companyRes] = await Promise.all([
    admin
      .from("investor_profiles")
      .select(
        "firm_name, investor_type, check_size_min, check_size_max, preferred_sectors, preferred_stages, preferred_geographies, investment_thesis",
      )
      .eq("profile_id", investorId)
      .maybeSingle(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any)
      .from("companies")
      .select("company_name, industry, revenue_stage, state, country, business_description, funding_amount")
      .eq("id", companyId)
      .maybeSingle() as Promise<{ data: CompanyRow | null }>,
  ]);

  const investor = investorRes.data;
  const company = companyRes.data;

  if (!company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  const sectors: string[] = Array.isArray(investor?.preferred_sectors)
    ? (investor.preferred_sectors as string[])
    : [];
  const stages: string[] = Array.isArray(investor?.preferred_stages)
    ? (investor.preferred_stages as string[])
    : [];

  if (!isClaudeConfigured()) {
    return NextResponse.json(
      fallbackResult(
        company.company_name ?? "Company",
        company.industry ?? null,
        company.revenue_stage ?? null,
        sectors,
        stages,
      ),
    );
  }

  const checkSize = investor?.check_size_min || investor?.check_size_max
    ? `$${(investor.check_size_min ?? 0).toLocaleString()}–$${(investor.check_size_max ?? 0).toLocaleString()}`
    : null;

  const investorContext = [
    investor?.firm_name ? `Firm: ${investor.firm_name}` : null,
    investor?.investor_type ? `Investor type: ${investor.investor_type}` : null,
    sectors.length ? `Preferred sectors: ${sectors.join(", ")}` : "No sector preference specified",
    stages.length ? `Preferred stages: ${stages.join(", ")}` : "No stage preference specified",
    Array.isArray(investor?.preferred_geographies) && (investor.preferred_geographies as string[]).length
      ? `Preferred geographies: ${(investor.preferred_geographies as string[]).join(", ")}`
      : null,
    checkSize ? `Typical check size: ${checkSize}` : null,
    investor?.investment_thesis ? `Investment thesis: ${investor.investment_thesis}` : null,
  ].filter(Boolean).join("\n");

  const location = [company.state, company.country].filter(Boolean).join(", ");
  const companyContext = [
    `Company: ${company.company_name ?? "Unknown"}`,
    company.industry ? `Industry: ${company.industry}` : null,
    company.revenue_stage ? `Stage: ${company.revenue_stage}` : null,
    location ? `Location: ${location}` : null,
    company.funding_amount ? `Raising: $${Number(company.funding_amount).toLocaleString()}` : null,
    company.business_description ? `Description: ${company.business_description}` : null,
  ].filter(Boolean).join("\n");

  const userMessage = `Investor preferences:\n${investorContext}\n\nCompany:\n${companyContext}\n\nGenerate a personalized thesis-fit brief for this investor.`;

  try {
    const raw = await claudeComplete(
      [{ role: "user", content: userMessage }],
      { model: CLAUDE_SONNET, maxTokens: 500, system: SYSTEM_PROMPT },
    );

    const cleaned = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    const result = JSON.parse(cleaned) as DealBriefResult;
    return NextResponse.json({ ...result, source: "claude" });
  } catch (err) {
    console.error("Deal brief AI error:", err);
    return NextResponse.json(
      fallbackResult(
        company.company_name ?? "Company",
        company.industry ?? null,
        company.revenue_stage ?? null,
        sectors,
        stages,
      ),
    );
  }
}
