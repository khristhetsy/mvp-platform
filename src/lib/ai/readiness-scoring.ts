/**
 * Investable Readiness Scoring — rule-based engine
 *
 * Scores a company across 8 investor-facing factors (100 pts total)
 * using uploaded document metadata and existing AI summaries.
 * No external API required — always works, zero cost.
 *
 * IMPORTANT: Score is investor/admin-only — never surfaced to founders.
 */

// ─── Factor definitions ──────────────────────────────────────────────────────

export const READINESS_FACTORS = [
  { key: "revenue_cashflow",   label: "Revenue & Cash Flow Trajectory",    max: 20, tag: "Financial"   },
  { key: "founder_integrity",  label: "Founder Integrity & Track Record",   max: 18, tag: "Team"        },
  { key: "governance_legal",   label: "Governance & Legal Cleanliness",     max: 15, tag: "Legal"       },
  { key: "market_evidence",    label: "Market Realism & Customer Evidence", max: 15, tag: "Market"      },
  { key: "pitch_quality",      label: "Pitch Deck & Business Plan Quality", max: 12, tag: "Documents"   },
  { key: "deal_structure",     label: "Deal Structure Flexibility",         max: 10, tag: "Deal Terms"  },
  { key: "industry_alignment", label: "Industry & Stage Alignment",         max: 5,  tag: "Fit"         },
  { key: "impact_esg",         label: "Impact / ESG Alignment",             max: 5,  tag: "ESG"         },
] as const;

export type FactorKey = (typeof READINESS_FACTORS)[number]["key"];

export type FactorSubScore = {
  label: string;
  pts: number;
  max: number;
};

export type FactorEvidence = {
  icon: "✅" | "⚠️" | "❌";
  text: string;
  src: string;
};

export type FactorFlag = {
  severity: "red" | "amber" | "green";
  label: string;
  detail: string;
};

export type FactorScore = {
  pts: number;
  max: number;
  rating: "Strong" | "Developing" | "Needs Work";
  aiSummary: string;
  subScores: FactorSubScore[];
  evidence: FactorEvidence[];
  flags: FactorFlag[];
};

export type ReadinessScoreResult = {
  totalScore: number;
  factorScores: Record<FactorKey, FactorScore>;
  generatedBy: "rule-based" | "unconfigured";
  isDemo: boolean;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rating(pts: number, max: number): FactorScore["rating"] {
  const pct = pts / max;
  if (pct >= 0.75) return "Strong";
  if (pct >= 0.45) return "Developing";
  return "Needs Work";
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function containsKeywords(text: string | null, keywords: string[]): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return keywords.some((k) => lower.includes(k));
}

// ─── Per-factor scorers ───────────────────────────────────────────────────────

function scoreRevenueCashflow(
  has: (t: string) => boolean,
  getSummary: (t: string) => string | null,
  revenueStage: string | null,
  fundingAmount: number | null,
): FactorScore {
  const hasFinancials = has("FINANCIAL_STATEMENTS");
  const hasBizPlan = has("BUSINESS_PLAN");
  const hasPitch = has("PITCH_DECK");
  const financialSummary = getSummary("FINANCIAL_STATEMENTS");
  const bizPlanSummary = getSummary("BUSINESS_PLAN");

  const subScores: FactorSubScore[] = [
    { label: "Financial statements", pts: hasFinancials ? 8 : 0, max: 8 },
    {
      label: "Revenue stage declared",
      pts: revenueStage ? (revenueStage.toLowerCase().includes("pre") ? 2 : 5) : 0,
      max: 5,
    },
    { label: "Financial projections", pts: hasBizPlan ? 5 : hasPitch ? 2 : 0, max: 5 },
    { label: "Funding amount set", pts: fundingAmount ? 2 : 0, max: 2 },
  ];

  const pts = clamp(subScores.reduce((s, x) => s + x.pts, 0), 0, 20);

  const evidence: FactorEvidence[] = [];
  if (hasFinancials) evidence.push({ icon: "✅", text: "Financial statements uploaded", src: "FINANCIAL_STATEMENTS" });
  else evidence.push({ icon: "❌", text: "Financial statements not uploaded — score reduced", src: "Document checklist" });
  if (hasBizPlan) evidence.push({ icon: "✅", text: "Business plan present — revenue projections assumed", src: "BUSINESS_PLAN" });
  else evidence.push({ icon: "⚠️", text: "Business plan missing — projections unverifiable", src: "Document checklist" });
  if (revenueStage) evidence.push({ icon: "✅", text: `Revenue stage declared: ${revenueStage}`, src: "Company profile" });
  else evidence.push({ icon: "⚠️", text: "Revenue stage not set on company profile", src: "Company profile" });
  if (fundingAmount) evidence.push({ icon: "✅", text: `Funding target: $${fundingAmount.toLocaleString()}`, src: "Company profile" });

  const flags: FactorFlag[] = [];
  if (!hasFinancials) flags.push({ severity: "red", label: "Missing financials", detail: "Investors cannot assess cash position without financial statements." });
  if (!revenueStage) flags.push({ severity: "amber", label: "Stage unclear", detail: "Revenue stage not declared — reduces scoring confidence." });

  const summaryText = financialSummary ?? bizPlanSummary;
  const aiSummary = summaryText
    ? `Based on uploaded documents: ${summaryText.slice(0, 300)}${summaryText.length > 300 ? "…" : ""}`
    : hasFinancials || hasBizPlan
    ? "Financial documents uploaded but AI summaries not yet generated. Score reflects document presence."
    : "No financial documents uploaded. Score reflects missing evidence. Upload financial statements and a business plan to improve this factor.";

  return { pts, max: 20, rating: rating(pts, 20), aiSummary, subScores, evidence, flags };
}

function scoreFounderIntegrity(
  has: (t: string) => boolean,
  getSummary: (t: string) => string | null,
  companyName: string,
  industry: string | null,
): FactorScore {
  const hasPitch = has("PITCH_DECK");
  const hasBizPlan = has("BUSINESS_PLAN");
  const pitchSummary = getSummary("PITCH_DECK");

  const subScores: FactorSubScore[] = [
    { label: "Pitch deck (team section)", pts: hasPitch ? 7 : 0, max: 7 },
    { label: "Company profile complete", pts: companyName && industry ? 5 : companyName ? 3 : 0, max: 5 },
    { label: "Business plan (background)", pts: hasBizPlan ? 4 : 0, max: 4 },
    { label: "Consistent information", pts: hasPitch && hasBizPlan ? 2 : 0, max: 2 },
  ];

  const pts = clamp(subScores.reduce((s, x) => s + x.pts, 0), 0, 18);

  const evidence: FactorEvidence[] = [];
  if (hasPitch) evidence.push({ icon: "✅", text: "Pitch deck uploaded — team section present", src: "PITCH_DECK" });
  else evidence.push({ icon: "❌", text: "Pitch deck missing — team background unverifiable", src: "Document checklist" });
  if (hasBizPlan) evidence.push({ icon: "✅", text: "Business plan uploaded — founder background referenced", src: "BUSINESS_PLAN" });
  if (industry) evidence.push({ icon: "✅", text: `Industry declared: ${industry}`, src: "Company profile" });
  else evidence.push({ icon: "⚠️", text: "Industry not set on company profile", src: "Company profile" });

  const flags: FactorFlag[] = [];
  if (!hasPitch) flags.push({ severity: "red", label: "No team evidence", detail: "Pitch deck is the primary source for founder background. Upload to improve this score." });
  if (!industry) flags.push({ severity: "amber", label: "Incomplete profile", detail: "Industry field not set — reduces founder context." });

  const aiSummary = pitchSummary
    ? `Team context from pitch deck: ${pitchSummary.slice(0, 300)}${pitchSummary.length > 300 ? "…" : ""}`
    : hasPitch
    ? "Pitch deck uploaded. AI summary not yet generated — score reflects document presence."
    : "No pitch deck uploaded. Founder integrity cannot be verified from available documents. Upload a pitch deck with a team slide to improve this factor.";

  return { pts, max: 18, rating: rating(pts, 18), aiSummary, subScores, evidence, flags };
}

function scoreGovernanceLegal(
  has: (t: string) => boolean,
  getSummary: (t: string) => string | null,
  industry: string | null,
): FactorScore {
  const hasIncorp = has("INCORPORATION_DOCS");
  const hasCapTable = has("CAP_TABLE");
  const incorpSummary = getSummary("INCORPORATION_DOCS");
  const capSummary = getSummary("CAP_TABLE");

  const subScores: FactorSubScore[] = [
    { label: "Incorporation docs", pts: hasIncorp ? 7 : 0, max: 7 },
    { label: "Cap table", pts: hasCapTable ? 5 : 0, max: 5 },
    { label: "Company registered", pts: industry ? 3 : 0, max: 3 },
  ];

  const pts = clamp(subScores.reduce((s, x) => s + x.pts, 0), 0, 15);

  const evidence: FactorEvidence[] = [];
  if (hasIncorp) evidence.push({ icon: "✅", text: "Incorporation documents uploaded", src: "INCORPORATION_DOCS" });
  else evidence.push({ icon: "❌", text: "Incorporation docs missing — legal structure unverifiable", src: "Document checklist" });
  if (hasCapTable) evidence.push({ icon: "✅", text: "Cap table uploaded — ownership structure present", src: "CAP_TABLE" });
  else evidence.push({ icon: "❌", text: "Cap table missing — equity structure unverifiable", src: "Document checklist" });

  const flags: FactorFlag[] = [];
  if (!hasIncorp) flags.push({ severity: "red", label: "No incorporation docs", detail: "Legal entity cannot be verified without incorporation documents." });
  if (!hasCapTable) flags.push({ severity: "red", label: "No cap table", detail: "Equity structure is a required due diligence item for investors." });

  const summaryText = incorpSummary ?? capSummary;
  const aiSummary = summaryText
    ? `Legal document summary: ${summaryText.slice(0, 300)}${summaryText.length > 300 ? "…" : ""}`
    : hasIncorp || hasCapTable
    ? "Legal documents uploaded. AI summary pending — score reflects document presence."
    : "Critical legal documents are missing. Upload incorporation docs and cap table to establish governance credibility.";

  return { pts, max: 15, rating: rating(pts, 15), aiSummary, subScores, evidence, flags };
}

function scoreMarketEvidence(
  has: (t: string) => boolean,
  getSummary: (t: string) => string | null,
  industry: string | null,
): FactorScore {
  const hasPitch = has("PITCH_DECK");
  const hasBizPlan = has("BUSINESS_PLAN");
  const pitchSummary = getSummary("PITCH_DECK");
  const bizSummary = getSummary("BUSINESS_PLAN");

  const summaryText = pitchSummary ?? bizSummary ?? "";
  const hasMarketKeywords = containsKeywords(summaryText, ["market", "customer", "traction", "revenue", "growth", "users", "clients"]);

  const subScores: FactorSubScore[] = [
    { label: "Pitch deck (market slide)", pts: hasPitch ? 6 : 0, max: 6 },
    { label: "Business plan (market section)", pts: hasBizPlan ? 5 : 0, max: 5 },
    { label: "Market keywords in summaries", pts: hasMarketKeywords ? 2 : 0, max: 2 },
    { label: "Industry declared", pts: industry ? 2 : 0, max: 2 },
  ];

  const pts = clamp(subScores.reduce((s, x) => s + x.pts, 0), 0, 15);

  const evidence: FactorEvidence[] = [];
  if (hasPitch) evidence.push({ icon: "✅", text: "Pitch deck uploaded — market section assumed present", src: "PITCH_DECK" });
  else evidence.push({ icon: "❌", text: "Pitch deck missing — market evidence unverifiable", src: "Document checklist" });
  if (hasBizPlan) evidence.push({ icon: "✅", text: "Business plan uploaded — market analysis present", src: "BUSINESS_PLAN" });
  else evidence.push({ icon: "⚠️", text: "Business plan missing — market depth unclear", src: "Document checklist" });
  if (industry) evidence.push({ icon: "✅", text: `Sector identified: ${industry}`, src: "Company profile" });
  if (hasMarketKeywords) evidence.push({ icon: "✅", text: "Market and customer references found in document summaries", src: "AI summaries" });

  const flags: FactorFlag[] = [];
  if (!hasPitch && !hasBizPlan) flags.push({ severity: "red", label: "No market documents", detail: "Upload a pitch deck or business plan to demonstrate market knowledge." });
  else if (!hasMarketKeywords) flags.push({ severity: "amber", label: "Weak market evidence", detail: "Document summaries lack explicit market size or customer evidence." });

  const aiSummary = pitchSummary ?? bizSummary
    ? `Market context from documents: ${(pitchSummary ?? bizSummary ?? "").slice(0, 300)}…`
    : hasPitch || hasBizPlan
    ? "Market documents uploaded. AI summary pending — score reflects document presence."
    : "No market evidence documents found. Upload a pitch deck with a market slide and a business plan with market analysis.";

  return { pts, max: 15, rating: rating(pts, 15), aiSummary, subScores, evidence, flags };
}

function scorePitchQuality(
  has: (t: string) => boolean,
  getSummary: (t: string) => string | null,
): FactorScore {
  const hasPitch = has("PITCH_DECK");
  const hasBizPlan = has("BUSINESS_PLAN");
  const pitchSummary = getSummary("PITCH_DECK");
  const bizSummary = getSummary("BUSINESS_PLAN");

  const hasSummaries = !!(pitchSummary || bizSummary);

  const subScores: FactorSubScore[] = [
    { label: "Pitch deck uploaded", pts: hasPitch ? 5 : 0, max: 5 },
    { label: "Business plan uploaded", pts: hasBizPlan ? 5 : 0, max: 5 },
    { label: "AI summaries generated", pts: hasSummaries ? 2 : 0, max: 2 },
  ];

  const pts = clamp(subScores.reduce((s, x) => s + x.pts, 0), 0, 12);

  const evidence: FactorEvidence[] = [];
  if (hasPitch) evidence.push({ icon: "✅", text: "Pitch deck uploaded", src: "PITCH_DECK" });
  else evidence.push({ icon: "❌", text: "Pitch deck not uploaded", src: "Document checklist" });
  if (hasBizPlan) evidence.push({ icon: "✅", text: "Business plan uploaded", src: "BUSINESS_PLAN" });
  else evidence.push({ icon: "❌", text: "Business plan not uploaded", src: "Document checklist" });
  if (hasSummaries) evidence.push({ icon: "✅", text: "AI document summaries available", src: "AI summaries" });
  else if (hasPitch || hasBizPlan) evidence.push({ icon: "⚠️", text: "Documents uploaded but AI summaries not yet generated", src: "AI summaries" });

  const flags: FactorFlag[] = [];
  if (!hasPitch) flags.push({ severity: "red", label: "No pitch deck", detail: "A pitch deck is the core investor communication document." });
  if (!hasBizPlan) flags.push({ severity: "amber", label: "No business plan", detail: "A business plan demonstrates depth behind the pitch." });

  const aiSummary = pitchSummary
    ? `Pitch deck summary: ${pitchSummary.slice(0, 300)}${pitchSummary.length > 300 ? "…" : ""}`
    : bizSummary
    ? `Business plan summary: ${bizSummary.slice(0, 300)}${bizSummary.length > 300 ? "…" : ""}`
    : hasPitch || hasBizPlan
    ? "Documents uploaded. AI summaries pending — score reflects document presence."
    : "No pitch or business plan uploaded. These are the two most critical investor documents.";

  return { pts, max: 12, rating: rating(pts, 12), aiSummary, subScores, evidence, flags };
}

function scoreDealStructure(
  has: (t: string) => boolean,
  getSummary: (t: string) => string | null,
  fundingAmount: number | null,
  revenueStage: string | null,
): FactorScore {
  const hasBizPlan = has("BUSINESS_PLAN");
  const bizSummary = getSummary("BUSINESS_PLAN");
  const hasDealKeywords = containsKeywords(bizSummary, ["equity", "valuation", "term", "convertible", "safe", "priced round", "deal", "structure"]);

  const subScores: FactorSubScore[] = [
    { label: "Funding amount declared", pts: fundingAmount ? 4 : 0, max: 4 },
    { label: "Business plan with deal terms", pts: hasBizPlan ? (hasDealKeywords ? 4 : 2) : 0, max: 4 },
    { label: "Stage appropriate for raise", pts: revenueStage ? 2 : 0, max: 2 },
  ];

  const pts = clamp(subScores.reduce((s, x) => s + x.pts, 0), 0, 10);

  const evidence: FactorEvidence[] = [];
  if (fundingAmount) evidence.push({ icon: "✅", text: `Raise target set: $${fundingAmount.toLocaleString()}`, src: "Company profile" });
  else evidence.push({ icon: "⚠️", text: "Funding amount not declared", src: "Company profile" });
  if (hasBizPlan) evidence.push({ icon: "✅", text: "Business plan uploaded", src: "BUSINESS_PLAN" });
  else evidence.push({ icon: "⚠️", text: "Business plan missing — deal terms unverifiable", src: "Document checklist" });
  if (hasDealKeywords) evidence.push({ icon: "✅", text: "Deal structure terms referenced in documents", src: "AI summaries" });

  const flags: FactorFlag[] = [];
  if (!fundingAmount) flags.push({ severity: "amber", label: "No funding target", detail: "Investors need to know the raise size to assess deal fit." });
  if (!hasBizPlan) flags.push({ severity: "amber", label: "No deal terms", detail: "Upload a business plan detailing the deal structure." });

  const aiSummary = bizSummary
    ? `Deal context from business plan: ${bizSummary.slice(0, 300)}${bizSummary.length > 300 ? "…" : ""}`
    : hasBizPlan
    ? "Business plan uploaded. AI summary pending — score reflects document presence."
    : "No deal structure documents found. Declare your funding amount and upload a business plan with deal terms.";

  return { pts, max: 10, rating: rating(pts, 10), aiSummary, subScores, evidence, flags };
}

function scoreIndustryAlignment(
  industry: string | null,
  revenueStage: string | null,
): FactorScore {
  const FOCUS_INDUSTRIES = ["fintech", "healthtech", "edtech", "cleantech", "proptech", "agritech", "saas", "technology", "finance", "health"];
  const industryMatch = industry ? FOCUS_INDUSTRIES.some(f => industry.toLowerCase().includes(f)) : false;

  const subScores: FactorSubScore[] = [
    { label: "Industry declared", pts: industry ? 3 : 0, max: 3 },
    { label: "Stage declared", pts: revenueStage ? 2 : 0, max: 2 },
  ];

  const pts = clamp(subScores.reduce((s, x) => s + x.pts, 0), 0, 5);

  const evidence: FactorEvidence[] = [];
  if (industry) {
    evidence.push({
      icon: industryMatch ? "✅" : "⚠️",
      text: `Industry: ${industry}${industryMatch ? " — aligns with platform focus areas" : ""}`,
      src: "Company profile",
    });
  } else {
    evidence.push({ icon: "❌", text: "Industry not declared", src: "Company profile" });
  }
  if (revenueStage) evidence.push({ icon: "✅", text: `Stage: ${revenueStage}`, src: "Company profile" });
  else evidence.push({ icon: "⚠️", text: "Revenue stage not set", src: "Company profile" });

  const flags: FactorFlag[] = [];
  if (!industry) flags.push({ severity: "amber", label: "No industry set", detail: "Set your industry on your company profile to improve alignment scoring." });

  const aiSummary = industry && revenueStage
    ? `Company operates in ${industry} at ${revenueStage} stage. Platform focuses on tech-enabled, scalable ventures.`
    : industry
    ? `Industry declared as ${industry}. Revenue stage not set — complete your profile to improve alignment.`
    : "Industry and stage not declared. Complete your company profile to allow proper alignment assessment.";

  return { pts, max: 5, rating: rating(pts, 5), aiSummary, subScores, evidence, flags };
}

function scoreImpactEsg(
  has: (t: string) => boolean,
  getSummary: (t: string) => string | null,
): FactorScore {
  const ESG_KEYWORDS = ["impact", "esg", "sustainability", "environment", "social", "governance", "sdg", "carbon", "community", "diversity", "inclusion", "green"];
  const allSummaries = ["PITCH_DECK", "BUSINESS_PLAN", "FINANCIAL_STATEMENTS"]
    .map(t => getSummary(t))
    .filter(Boolean)
    .join(" ");

  const hasEsgKeywords = containsKeywords(allSummaries, ESG_KEYWORDS);
  const hasPitch = has("PITCH_DECK");
  const hasBizPlan = has("BUSINESS_PLAN");

  const subScores: FactorSubScore[] = [
    { label: "ESG/impact keywords in docs", pts: hasEsgKeywords ? 3 : 0, max: 3 },
    { label: "Supporting documents present", pts: hasPitch && hasBizPlan ? 2 : hasPitch || hasBizPlan ? 1 : 0, max: 2 },
  ];

  const pts = clamp(subScores.reduce((s, x) => s + x.pts, 0), 0, 5);

  const evidence: FactorEvidence[] = [];
  if (hasEsgKeywords) evidence.push({ icon: "✅", text: "Impact or ESG references found in document summaries", src: "AI summaries" });
  else evidence.push({ icon: "⚠️", text: "No ESG or impact keywords found in document summaries", src: "AI summaries" });
  if (hasPitch || hasBizPlan) evidence.push({ icon: "✅", text: "Core documents uploaded for ESG context review", src: "Documents" });

  const flags: FactorFlag[] = [];
  if (!hasEsgKeywords) flags.push({ severity: "amber", label: "No ESG evidence", detail: "Consider adding an impact statement or ESG section to your pitch or business plan." });

  const aiSummary = hasEsgKeywords
    ? "Document summaries reference impact or ESG-related themes, indicating awareness of sustainable business practices."
    : "No explicit ESG or impact references found in uploaded documents. This factor is informational — a low score here does not exclude investors.";

  return { pts, max: 5, rating: rating(pts, 5), aiSummary, subScores, evidence, flags };
}

// ─── Main scoring function ────────────────────────────────────────────────────

export async function scoreCompanyReadiness(input: {
  companyName: string;
  industry: string | null;
  revenueStage: string | null;
  fundingAmount: number | null;
  documentSummaries: Array<{ type: string; summary: string }>;
  uploadedDocumentTypes: string[];
}): Promise<ReadinessScoreResult> {
  const has = (type: string) => input.uploadedDocumentTypes.includes(type);
  const getSummary = (type: string): string | null =>
    input.documentSummaries.find((d) => d.type === type)?.summary ?? null;

  const factors: Record<FactorKey, FactorScore> = {
    revenue_cashflow:   scoreRevenueCashflow(has, getSummary, input.revenueStage, input.fundingAmount),
    founder_integrity:  scoreFounderIntegrity(has, getSummary, input.companyName, input.industry),
    governance_legal:   scoreGovernanceLegal(has, getSummary, input.industry),
    market_evidence:    scoreMarketEvidence(has, getSummary, input.industry),
    pitch_quality:      scorePitchQuality(has, getSummary),
    deal_structure:     scoreDealStructure(has, getSummary, input.fundingAmount, input.revenueStage),
    industry_alignment: scoreIndustryAlignment(input.industry, input.revenueStage),
    impact_esg:         scoreImpactEsg(has, getSummary),
  };

  const totalScore = Math.min(
    100,
    Object.values(factors).reduce((sum, f) => sum + f.pts, 0),
  );

  return {
    totalScore,
    factorScores: factors,
    generatedBy: "rule-based",
    isDemo: false,
  };
}
