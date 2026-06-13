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
  if (pct >= 0.80) return "Strong";
  if (pct >= 0.60) return "Developing";
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

  // Full credit only if AI summary exists; doc-only = 50%
  const financialPts = hasFinancials ? (financialSummary ? 10 : 5) : 0;
  const isPreRevenue = revenueStage?.toLowerCase().includes("pre") ?? false;
  const stagePts = revenueStage ? (isPreRevenue ? 1 : revenueStage.toLowerCase().includes("early") ? 3 : 5) : 0;
  const projectionPts = hasBizPlan ? (bizPlanSummary ? 4 : 2) : hasPitch ? 1 : 0;
  const fundingPts = fundingAmount ? 2 : 0;

  const subScores: FactorSubScore[] = [
    { label: "Financial statements (+ AI analysis)", pts: financialPts, max: 10 },
    { label: "Revenue stage (post-revenue earns full pts)", pts: stagePts, max: 5 },
    { label: "Financial projections in business plan", pts: projectionPts, max: 4 },
    { label: "Funding amount declared", pts: fundingPts, max: 2 },
  ];

  // Hard cap: no financials = max 8 pts; pre-revenue only = additional -3 cap
  let pts = clamp(subScores.reduce((s, x) => s + x.pts, 0), 0, 20);
  if (!hasFinancials) pts = Math.min(pts, 8);
  if (isPreRevenue && !hasFinancials) pts = Math.min(pts, 4);

  const evidence: FactorEvidence[] = [];
  if (hasFinancials) {
    evidence.push({ icon: "✅", text: financialSummary ? "Financial statements uploaded with AI analysis" : "Financial statements uploaded — AI summary pending (partial credit)", src: "FINANCIAL_STATEMENTS" });
  } else {
    evidence.push({ icon: "❌", text: "Financial statements not uploaded — score hard-capped at 8/20", src: "Document checklist" });
  }
  if (hasBizPlan) evidence.push({ icon: "✅", text: bizPlanSummary ? "Business plan with projections analysed" : "Business plan uploaded — AI summary pending", src: "BUSINESS_PLAN" });
  else evidence.push({ icon: "⚠️", text: "Business plan missing — projections unverifiable", src: "Document checklist" });
  if (revenueStage) evidence.push({ icon: isPreRevenue ? "⚠️" : "✅", text: `Revenue stage: ${revenueStage}${isPreRevenue ? " — pre-revenue significantly limits score" : ""}`, src: "Company profile" });
  else evidence.push({ icon: "❌", text: "Revenue stage not set", src: "Company profile" });
  if (fundingAmount) evidence.push({ icon: "✅", text: `Funding target: $${fundingAmount.toLocaleString()}`, src: "Company profile" });
  else evidence.push({ icon: "⚠️", text: "Funding target not declared", src: "Company profile" });

  const flags: FactorFlag[] = [];
  if (!hasFinancials) flags.push({ severity: "red", label: "Missing financials", detail: "Investors cannot assess cash position or runway without financial statements. This factor is hard-capped at 8/20 without them." });
  if (isPreRevenue) flags.push({ severity: "red", label: "Pre-revenue company", detail: "Pre-revenue status significantly limits this factor score. Demonstrating any revenue traction is critical." });
  else if (!revenueStage) flags.push({ severity: "amber", label: "Stage unclear", detail: "Revenue stage not declared — score confidence reduced." });
  if (!hasBizPlan) flags.push({ severity: "amber", label: "No business plan", detail: "Financial projections cannot be assessed without a business plan." });

  const summaryText = financialSummary ?? bizPlanSummary;
  const aiSummary = summaryText
    ? `Based on uploaded documents: ${summaryText.slice(0, 300)}${summaryText.length > 300 ? "…" : ""}`
    : hasFinancials || hasBizPlan
    ? "Financial documents uploaded but AI summaries not yet generated. Score is discounted — re-score after summaries are available."
    : "No financial documents uploaded. This is the highest-weight factor. Upload audited or management financial statements immediately.";

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
  const bizSummary = getSummary("BUSINESS_PLAN");

  const TEAM_KEYWORDS = ["founder", "team", "ceo", "cto", "cfo", "co-founder", "experience", "background", "track record", "led", "built", "years"];
  const pitchHasTeam = containsKeywords(pitchSummary, TEAM_KEYWORDS);
  const bizHasTeam = containsKeywords(bizSummary, TEAM_KEYWORDS);

  // Full credit requires AI summary with founder keywords
  const pitchPts = hasPitch ? (pitchHasTeam ? 8 : pitchSummary ? 4 : 3) : 0;
  const profilePts = companyName && industry ? 4 : companyName ? 2 : 0;
  const bizPts = hasBizPlan ? (bizHasTeam ? 4 : bizSummary ? 2 : 1) : 0;
  const consistencyPts = pitchHasTeam && bizHasTeam ? 2 : 0;

  const subScores: FactorSubScore[] = [
    { label: "Pitch deck with team evidence", pts: pitchPts, max: 8 },
    { label: "Complete company profile", pts: profilePts, max: 4 },
    { label: "Business plan with founder background", pts: bizPts, max: 4 },
    { label: "Cross-document consistency", pts: consistencyPts, max: 2 },
  ];

  // Hard cap: no pitch = max 10; no team keywords anywhere = max 12
  let pts = clamp(subScores.reduce((s, x) => s + x.pts, 0), 0, 18);
  if (!hasPitch) pts = Math.min(pts, 10);
  if (!pitchHasTeam && !bizHasTeam) pts = Math.min(pts, 11);

  const evidence: FactorEvidence[] = [];
  if (hasPitch) {
    evidence.push({ icon: pitchHasTeam ? "✅" : "⚠️", text: pitchHasTeam ? "Pitch deck with team/founder references confirmed" : pitchSummary ? "Pitch deck uploaded — no clear team section found in summary" : "Pitch deck uploaded — AI summary pending (partial credit only)", src: "PITCH_DECK" });
  } else {
    evidence.push({ icon: "❌", text: "Pitch deck missing — team background unverifiable, score capped at 10/18", src: "Document checklist" });
  }
  if (hasBizPlan) {
    evidence.push({ icon: bizHasTeam ? "✅" : "⚠️", text: bizHasTeam ? "Business plan references founder/team background" : "Business plan uploaded but no founder context detected", src: "BUSINESS_PLAN" });
  } else {
    evidence.push({ icon: "⚠️", text: "Business plan missing — secondary founder evidence unavailable", src: "Document checklist" });
  }
  if (industry) evidence.push({ icon: "✅", text: `Industry declared: ${industry}`, src: "Company profile" });
  else evidence.push({ icon: "⚠️", text: "Industry not set — reduces profile completeness", src: "Company profile" });

  const flags: FactorFlag[] = [];
  if (!hasPitch) flags.push({ severity: "red", label: "No team evidence", detail: "Pitch deck with a team slide is required. Without it, founder integrity cannot be assessed and score is capped at 10/18." });
  else if (!pitchHasTeam) flags.push({ severity: "amber", label: "No team section detected", detail: "Pitch deck uploaded but AI summary contains no founder/team references. Ensure your deck includes a team slide." });
  if (!hasBizPlan) flags.push({ severity: "amber", label: "No business plan", detail: "A business plan with founder background is a secondary integrity signal. Upload one to strengthen this factor." });
  if (!industry) flags.push({ severity: "amber", label: "Incomplete profile", detail: "Industry not declared — reduces founder context score." });

  const aiSummary = pitchSummary
    ? `Team context from pitch deck: ${pitchSummary.slice(0, 300)}${pitchSummary.length > 300 ? "…" : ""}`
    : hasPitch
    ? "Pitch deck uploaded. AI summary not yet generated — score discounted until summaries are available."
    : "No pitch deck uploaded. Founder integrity cannot be assessed. Upload a pitch deck with a dedicated team slide.";

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

  // Both docs required to unlock full scoring; partial credit if only one
  const incorpPts = hasIncorp ? (incorpSummary ? 7 : 4) : 0;
  const capPts = hasCapTable ? (capSummary ? 6 : 3) : 0;
  const profilePts = industry ? 2 : 0;

  const subScores: FactorSubScore[] = [
    { label: "Incorporation docs (+ AI review)", pts: incorpPts, max: 7 },
    { label: "Cap table (+ AI review)", pts: capPts, max: 6 },
    { label: "Company profile (industry set)", pts: profilePts, max: 2 },
  ];

  // Hard cap: missing either critical document = max 6 pts
  let pts = clamp(subScores.reduce((s, x) => s + x.pts, 0), 0, 15);
  if (!hasIncorp || !hasCapTable) pts = Math.min(pts, 6);

  const evidence: FactorEvidence[] = [];
  if (hasIncorp) {
    evidence.push({ icon: "✅", text: incorpSummary ? "Incorporation documents uploaded and reviewed" : "Incorporation documents uploaded — AI review pending (partial credit)", src: "INCORPORATION_DOCS" });
  } else {
    evidence.push({ icon: "❌", text: "Incorporation docs missing — score hard-capped at 6/15 until both critical docs are present", src: "Document checklist" });
  }
  if (hasCapTable) {
    evidence.push({ icon: "✅", text: capSummary ? "Cap table uploaded and reviewed" : "Cap table uploaded — AI review pending (partial credit)", src: "CAP_TABLE" });
  } else {
    evidence.push({ icon: "❌", text: "Cap table missing — equity structure unverifiable", src: "Document checklist" });
  }

  const flags: FactorFlag[] = [];
  if (!hasIncorp) flags.push({ severity: "red", label: "No incorporation docs", detail: "Legal entity cannot be verified. Score is hard-capped at 6/15 until both incorporation docs and cap table are uploaded." });
  if (!hasCapTable) flags.push({ severity: "red", label: "No cap table", detail: "Cap table is a mandatory due diligence document. No exceptions. Score is capped at 6/15 without it." });
  if (hasIncorp && !incorpSummary) flags.push({ severity: "amber", label: "AI review pending", detail: "Incorporation docs uploaded but AI analysis not yet generated — only partial credit awarded." });
  if (hasCapTable && !capSummary) flags.push({ severity: "amber", label: "AI review pending", detail: "Cap table uploaded but AI analysis not yet generated — only partial credit awarded." });

  const summaryText = incorpSummary ?? capSummary;
  const aiSummary = summaryText
    ? `Legal document summary: ${summaryText.slice(0, 300)}${summaryText.length > 300 ? "…" : ""}`
    : hasIncorp || hasCapTable
    ? "Legal documents uploaded. AI review pending — score is discounted. Re-score after summaries are generated."
    : "Both critical governance documents are missing. This factor cannot score above 6/15 until incorporation docs and cap table are uploaded.";

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

  const summaryText = [pitchSummary, bizSummary].filter(Boolean).join(" ");
  // Generic market words — easy to include but low signal
  const hasBasicMarketWords = containsKeywords(summaryText, ["market", "customer", "users", "clients"]);
  // Specific traction evidence — high signal
  const hasTractionEvidence = containsKeywords(summaryText, ["traction", "revenue", "mrr", "arr", "growth", "paying", "contracts", "signed", "pilot", "customers", "%", "$", "million", "thousand"]);

  // Pitch needs AI summary with specific evidence for full credit
  const pitchPts = hasPitch ? (hasTractionEvidence ? 7 : hasBasicMarketWords ? 4 : pitchSummary ? 3 : 2) : 0;
  const bizPts = hasBizPlan ? (hasTractionEvidence ? 5 : bizSummary ? 3 : 1) : 0;
  const tactionPts = hasTractionEvidence ? 2 : hasBasicMarketWords ? 1 : 0;
  const industryPts = industry ? 1 : 0;

  const subScores: FactorSubScore[] = [
    { label: "Pitch deck with market evidence", pts: pitchPts, max: 7 },
    { label: "Business plan with market analysis", pts: bizPts, max: 5 },
    { label: "Specific traction/metrics in docs", pts: tactionPts, max: 2 },
    { label: "Industry declared", pts: industryPts, max: 1 },
  ];

  // Hard cap: no docs = 0; neither has summaries = max 5
  let pts = clamp(subScores.reduce((s, x) => s + x.pts, 0), 0, 15);
  if (!hasPitch && !hasBizPlan) pts = 0;
  else if (!pitchSummary && !bizSummary) pts = Math.min(pts, 5);
  else if (!hasTractionEvidence) pts = Math.min(pts, 9);

  const evidence: FactorEvidence[] = [];
  if (hasPitch) {
    evidence.push({ icon: hasTractionEvidence ? "✅" : pitchSummary ? "⚠️" : "⚠️", text: hasTractionEvidence ? "Pitch deck with specific traction metrics found" : pitchSummary ? "Pitch deck uploaded — no specific traction data detected in summary" : "Pitch deck uploaded — AI summary pending", src: "PITCH_DECK" });
  } else {
    evidence.push({ icon: "❌", text: "Pitch deck missing — market claims cannot be verified", src: "Document checklist" });
  }
  if (hasBizPlan) {
    evidence.push({ icon: hasTractionEvidence ? "✅" : "⚠️", text: hasTractionEvidence ? "Business plan references market metrics" : bizSummary ? "Business plan present — limited quantitative market evidence" : "Business plan uploaded — AI summary pending", src: "BUSINESS_PLAN" });
  } else {
    evidence.push({ icon: "⚠️", text: "Business plan missing — market depth unverifiable", src: "Document checklist" });
  }
  if (hasTractionEvidence) evidence.push({ icon: "✅", text: "Specific traction metrics or financial figures found in summaries", src: "AI summaries" });
  else if (hasBasicMarketWords) evidence.push({ icon: "⚠️", text: "Generic market language found — no specific metrics or traction data", src: "AI summaries" });
  if (industry) evidence.push({ icon: "✅", text: `Sector: ${industry}`, src: "Company profile" });

  const flags: FactorFlag[] = [];
  if (!hasPitch && !hasBizPlan) flags.push({ severity: "red", label: "No market documents", detail: "No market evidence possible without a pitch deck or business plan. Score is 0." });
  else if (!hasTractionEvidence) flags.push({ severity: "red", label: "No traction evidence", detail: "Documents lack specific metrics, customer numbers, or revenue figures. Score capped at 9/15 without quantitative evidence." });
  else if (!hasBasicMarketWords) flags.push({ severity: "amber", label: "Weak market language", detail: "Document summaries lack explicit market or customer references." });

  const aiSummary = pitchSummary ?? bizSummary
    ? `Market context from documents: ${(pitchSummary ?? bizSummary ?? "").slice(0, 300)}…`
    : hasPitch || hasBizPlan
    ? "Market documents uploaded but AI summaries not yet available. Score is heavily discounted until summaries are generated."
    : "No market evidence documents found. Upload a pitch deck with specific customer and market data to score this factor.";

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
    { label: "Pitch deck (+ AI review)", pts: hasPitch ? (pitchSummary ? 5 : 2) : 0, max: 5 },
    { label: "Business plan (+ AI review)", pts: hasBizPlan ? (bizSummary ? 5 : 2) : 0, max: 5 },
    { label: "Both docs with summaries", pts: hasSummaries && hasPitch && hasBizPlan ? 2 : 0, max: 2 },
  ];

  const pts = clamp(subScores.reduce((s, x) => s + x.pts, 0), 0, 12);

  const evidence: FactorEvidence[] = [];
  if (hasPitch) evidence.push({ icon: "✅", text: pitchSummary ? "Pitch deck uploaded and AI-reviewed" : "Pitch deck uploaded — AI review pending (heavily discounted)", src: "PITCH_DECK" });
  else evidence.push({ icon: "❌", text: "Pitch deck not uploaded", src: "Document checklist" });
  if (hasBizPlan) evidence.push({ icon: "✅", text: bizSummary ? "Business plan uploaded and AI-reviewed" : "Business plan uploaded — AI review pending (heavily discounted)", src: "BUSINESS_PLAN" });
  else evidence.push({ icon: "❌", text: "Business plan not uploaded", src: "Document checklist" });
  if (hasSummaries) evidence.push({ icon: "✅", text: "AI document summaries available — full credit unlocked", src: "AI summaries" });
  else if (hasPitch || hasBizPlan) evidence.push({ icon: "⚠️", text: "Documents uploaded but AI summaries not yet generated — score heavily discounted", src: "AI summaries" });

  const flags: FactorFlag[] = [];
  if (!hasPitch) flags.push({ severity: "red", label: "No pitch deck", detail: "A pitch deck is the core investor communication document. Required for a competitive score." });
  if (!hasBizPlan) flags.push({ severity: "red", label: "No business plan", detail: "A business plan is required alongside the pitch deck. Without it, pitch quality cannot be fully scored." });
  if ((hasPitch || hasBizPlan) && !hasSummaries) flags.push({ severity: "amber", label: "AI review pending", detail: "Documents uploaded but no AI summaries yet. Score is set to 2/5 per document until summaries are available." });

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
    { label: "Industry in platform focus areas", pts: industryMatch ? 3 : industry ? 1 : 0, max: 3 },
    { label: "Stage declared", pts: revenueStage ? 2 : 0, max: 2 },
  ];

  const pts = clamp(subScores.reduce((s, x) => s + x.pts, 0), 0, 5);

  const evidence: FactorEvidence[] = [];
  if (industry) {
    evidence.push({
      icon: industryMatch ? "✅" : "⚠️",
      text: industryMatch
        ? `Industry: ${industry} — matches platform focus areas`
        : `Industry: ${industry} — outside platform focus areas (1/3 pts)`,
      src: "Company profile",
    });
  } else {
    evidence.push({ icon: "❌", text: "Industry not declared", src: "Company profile" });
  }
  if (revenueStage) evidence.push({ icon: "✅", text: `Stage: ${revenueStage}`, src: "Company profile" });
  else evidence.push({ icon: "⚠️", text: "Revenue stage not set", src: "Company profile" });

  const flags: FactorFlag[] = [];
  if (!industry) flags.push({ severity: "amber", label: "No industry set", detail: "Industry not declared — cannot assess platform alignment." });
  else if (!industryMatch) flags.push({ severity: "amber", label: "Outside focus areas", detail: `${industry} is outside the platform's focus industries. Only 1/3 pts awarded for industry alignment.` });

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
