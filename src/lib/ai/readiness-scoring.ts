/**
 * Investable Readiness Scoring — rule-based engine v2
 *
 * 10 factors, 100 pts total. Scored from uploaded document metadata
 * and existing AI summaries. No external API required.
 *
 * IMPORTANT: Score is investor/admin-only — never surfaced to founders.
 */

// ─── Factor definitions ──────────────────────────────────────────────────────

export const READINESS_FACTORS = [
  { key: "revenue_cashflow",   label: "Revenue & Cash Flow Trajectory",        max: 18, tag: "Financial"   },
  { key: "founder_team",       label: "Founder Integrity & Team Depth",         max: 15, tag: "Team"        },
  { key: "governance_legal",   label: "Governance & Legal Cleanliness",         max: 12, tag: "Legal"       },
  { key: "market_evidence",    label: "Market & Competitive Evidence",          max: 13, tag: "Market"      },
  { key: "ip_moat",            label: "IP Protection & Competitive Moat",       max: 10, tag: "Moat"        },
  { key: "burn_runway",        label: "Burn Rate & Runway",                     max: 10, tag: "Financial"   },
  { key: "pitch_quality",      label: "Pitch Deck & Business Plan Quality",     max: 8,  tag: "Documents"   },
  { key: "deal_structure",     label: "Deal Structure & Use of Funds",          max: 8,  tag: "Deal Terms"  },
  { key: "industry_alignment", label: "Industry & Stage Alignment",             max: 3,  tag: "Fit"         },
  { key: "impact_esg",         label: "Impact / ESG Alignment",                 max: 3,  tag: "ESG"         },
] as const;

// Sanity check: sum of max = 100
// 18+15+12+13+10+10+8+8+3+3 = 100 ✓

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

function countKeywordMatches(text: string | null, keywords: string[]): number {
  if (!text) return 0;
  const lower = text.toLowerCase();
  return keywords.filter((k) => lower.includes(k)).length;
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

  const isPreRevenue = revenueStage?.toLowerCase().includes("pre") ?? false;
  const isEarlyRevenue = revenueStage?.toLowerCase().includes("early") ?? false;

  // Full credit only if AI summary exists; doc-only = 50%
  const financialPts = hasFinancials ? (financialSummary ? 10 : 5) : 0;
  const stagePts = revenueStage
    ? isPreRevenue ? 1 : isEarlyRevenue ? 3 : 5
    : 0;
  const projectionPts = hasBizPlan ? (bizPlanSummary ? 4 : 2) : hasPitch ? 1 : 0;
  const fundingPts = fundingAmount ? 2 : 0;

  const subScores: FactorSubScore[] = [
    { label: "Financial statements (+ AI analysis)", pts: financialPts, max: 10 },
    { label: "Revenue stage (post-revenue = full pts)", pts: stagePts, max: 5 },
    { label: "Financial projections in business plan", pts: projectionPts, max: 4 },
    { label: "Funding amount declared", pts: fundingPts, max: 2 },
  ];

  // Hard caps
  let pts = clamp(subScores.reduce((s, x) => s + x.pts, 0), 0, 18);
  if (!hasFinancials) pts = Math.min(pts, 7);
  if (isPreRevenue && !hasFinancials) pts = Math.min(pts, 4);

  const evidence: FactorEvidence[] = [];
  if (hasFinancials) {
    evidence.push({ icon: "✅", text: financialSummary ? "Financial statements uploaded with AI analysis" : "Financial statements uploaded — AI summary pending (partial credit)", src: "FINANCIAL_STATEMENTS" });
  } else {
    evidence.push({ icon: "❌", text: "Financial statements not uploaded — score hard-capped at 7/18", src: "Document checklist" });
  }
  if (hasBizPlan) {
    evidence.push({ icon: "✅", text: bizPlanSummary ? "Business plan with projections analysed" : "Business plan uploaded — AI summary pending", src: "BUSINESS_PLAN" });
  } else {
    evidence.push({ icon: "⚠️", text: "Business plan missing — projections unverifiable", src: "Document checklist" });
  }
  if (revenueStage) {
    evidence.push({ icon: isPreRevenue ? "⚠️" : "✅", text: `Revenue stage: ${revenueStage}${isPreRevenue ? " — pre-revenue significantly limits score" : ""}`, src: "Company profile" });
  } else {
    evidence.push({ icon: "❌", text: "Revenue stage not set", src: "Company profile" });
  }
  if (fundingAmount) evidence.push({ icon: "✅", text: `Funding target: $${fundingAmount.toLocaleString()}`, src: "Company profile" });
  else evidence.push({ icon: "⚠️", text: "Funding target not declared", src: "Company profile" });

  const flags: FactorFlag[] = [];
  if (!hasFinancials) flags.push({ severity: "red", label: "Missing financials", detail: "Investors cannot assess cash position without financial statements. Hard-capped at 7/18." });
  if (isPreRevenue) flags.push({ severity: "red", label: "Pre-revenue", detail: "Pre-revenue status is a significant risk signal. Any revenue traction is critical to demonstrate." });
  else if (!revenueStage) flags.push({ severity: "amber", label: "Stage unclear", detail: "Revenue stage not declared — score confidence reduced." });
  if (!hasBizPlan) flags.push({ severity: "amber", label: "No business plan", detail: "Financial projections cannot be assessed without a business plan." });

  const summaryText = financialSummary ?? bizPlanSummary;
  const aiSummary = summaryText
    ? `Based on uploaded documents: ${summaryText.slice(0, 300)}${summaryText.length > 300 ? "…" : ""}`
    : hasFinancials || hasBizPlan
    ? "Financial documents uploaded but AI summaries not yet generated. Score is discounted — re-score after summaries are available."
    : "No financial documents uploaded. This is the highest-weight factor. Upload financial statements immediately.";

  return { pts, max: 18, rating: rating(pts, 18), aiSummary, subScores, evidence, flags };
}

function scoreFounderTeam(
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
  const DEPTH_KEYWORDS = ["co-founder", "cto", "cfo", "vp ", "director", "advisory", "advisor", "board", "employees", "team of", "hire", "leadership"];
  const EXPERIENCE_KEYWORDS = ["exit", "acquired", "sold", "ipo", "previous startup", "founded", "serial entrepreneur", "prior company", "raised", "venture"];

  const combinedSummary = [pitchSummary, bizSummary].filter(Boolean).join(" ");
  const hasTeamEvidence = containsKeywords(combinedSummary, TEAM_KEYWORDS);
  const hasTeamDepth = containsKeywords(combinedSummary, DEPTH_KEYWORDS);
  const hasPriorExperience = containsKeywords(combinedSummary, EXPERIENCE_KEYWORDS);

  // Pitch: up to 7 pts — requires team keywords + depth for full credit
  const pitchPts = hasPitch
    ? (hasTeamDepth ? 7 : hasTeamEvidence ? 4 : pitchSummary ? 2 : 2)
    : 0;

  // Biz plan: up to 4 pts
  const bizPts = hasBizPlan
    ? (hasTeamEvidence ? 4 : bizSummary ? 2 : 1)
    : 0;

  // Prior experience: 2 pts
  const expPts = hasPriorExperience ? 2 : 0;

  // Profile completeness: 2 pts
  const profilePts = companyName && industry ? 2 : companyName ? 1 : 0;

  const subScores: FactorSubScore[] = [
    { label: "Pitch deck with team evidence", pts: pitchPts, max: 7 },
    { label: "Business plan with founder background", pts: bizPts, max: 4 },
    { label: "Prior exits or venture experience", pts: expPts, max: 2 },
    { label: "Complete company profile", pts: profilePts, max: 2 },
  ];

  // Hard caps
  let pts = clamp(subScores.reduce((s, x) => s + x.pts, 0), 0, 15);
  if (!hasPitch) pts = Math.min(pts, 8);
  if (!hasTeamDepth) pts = Math.min(pts, 10); // solo founder penalty

  const evidence: FactorEvidence[] = [];
  if (hasPitch) {
    evidence.push({
      icon: hasTeamDepth ? "✅" : hasTeamEvidence ? "⚠️" : "⚠️",
      text: hasTeamDepth
        ? "Pitch deck — team depth (multiple roles/advisors) confirmed"
        : hasTeamEvidence
        ? "Pitch deck — founder mentioned but limited team depth evidence"
        : pitchSummary
        ? "Pitch deck uploaded — no team section detected in AI summary"
        : "Pitch deck uploaded — AI summary pending",
      src: "PITCH_DECK",
    });
  } else {
    evidence.push({ icon: "❌", text: "Pitch deck missing — team background unverifiable, score capped at 8/15", src: "Document checklist" });
  }
  if (hasBizPlan) {
    evidence.push({ icon: hasTeamEvidence ? "✅" : "⚠️", text: hasTeamEvidence ? "Business plan references founder/team background" : "Business plan uploaded — no team context detected", src: "BUSINESS_PLAN" });
  } else {
    evidence.push({ icon: "⚠️", text: "Business plan missing — secondary team evidence unavailable", src: "Document checklist" });
  }
  if (hasPriorExperience) evidence.push({ icon: "✅", text: "Prior exits, venture experience, or founded companies referenced", src: "AI summaries" });
  else evidence.push({ icon: "⚠️", text: "No prior exit or venture experience detected in documents", src: "AI summaries" });
  if (industry) evidence.push({ icon: "✅", text: `Industry declared: ${industry}`, src: "Company profile" });
  else evidence.push({ icon: "⚠️", text: "Industry not set on profile", src: "Company profile" });

  const flags: FactorFlag[] = [];
  if (!hasPitch) flags.push({ severity: "red", label: "No team evidence", detail: "Pitch deck with a team slide is required. Score capped at 8/15 without it." });
  else if (!hasTeamDepth) flags.push({ severity: "amber", label: "Solo founder risk", detail: "No team depth detected — advisors, co-founders, or a leadership team are expected by investors. Score capped at 10/15." });
  else if (!hasTeamEvidence) flags.push({ severity: "amber", label: "No team section detected", detail: "Pitch deck uploaded but AI summary contains no founder/team references." });
  if (!hasPriorExperience) flags.push({ severity: "amber", label: "No prior experience evidence", detail: "Prior exits or venture experience significantly strengthens investor confidence. Include in pitch or biz plan." });
  if (!hasBizPlan) flags.push({ severity: "amber", label: "No business plan", detail: "A business plan with founder background is a secondary integrity signal." });

  const aiSummary = pitchSummary
    ? `Team context from pitch deck: ${pitchSummary.slice(0, 300)}${pitchSummary.length > 300 ? "…" : ""}`
    : hasPitch
    ? "Pitch deck uploaded. AI summary not yet generated — score discounted until summaries are available."
    : "No pitch deck uploaded. Founder integrity and team depth cannot be assessed.";

  return { pts, max: 15, rating: rating(pts, 15), aiSummary, subScores, evidence, flags };
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

  const incorpPts = hasIncorp ? (incorpSummary ? 6 : 3) : 0;
  const capPts = hasCapTable ? (capSummary ? 5 : 2) : 0;
  const profilePts = industry ? 1 : 0;

  const subScores: FactorSubScore[] = [
    { label: "Incorporation docs (+ AI review)", pts: incorpPts, max: 6 },
    { label: "Cap table (+ AI review)", pts: capPts, max: 5 },
    { label: "Company profile (industry set)", pts: profilePts, max: 1 },
  ];

  // Hard cap: missing either = max 5
  let pts = clamp(subScores.reduce((s, x) => s + x.pts, 0), 0, 12);
  if (!hasIncorp || !hasCapTable) pts = Math.min(pts, 5);

  const evidence: FactorEvidence[] = [];
  if (hasIncorp) {
    evidence.push({ icon: "✅", text: incorpSummary ? "Incorporation documents uploaded and reviewed" : "Incorporation documents uploaded — AI review pending (partial credit)", src: "INCORPORATION_DOCS" });
  } else {
    evidence.push({ icon: "❌", text: "Incorporation docs missing — score hard-capped at 5/12", src: "Document checklist" });
  }
  if (hasCapTable) {
    evidence.push({ icon: "✅", text: capSummary ? "Cap table uploaded and reviewed" : "Cap table uploaded — AI review pending (partial credit)", src: "CAP_TABLE" });
  } else {
    evidence.push({ icon: "❌", text: "Cap table missing — equity structure unverifiable", src: "Document checklist" });
  }

  const flags: FactorFlag[] = [];
  if (!hasIncorp) flags.push({ severity: "red", label: "No incorporation docs", detail: "Legal entity cannot be verified. Score hard-capped at 5/12 until both docs are present." });
  if (!hasCapTable) flags.push({ severity: "red", label: "No cap table", detail: "Cap table is mandatory due diligence. No exceptions." });
  if (hasIncorp && !incorpSummary) flags.push({ severity: "amber", label: "AI review pending", detail: "Incorporation docs uploaded but not yet analysed — partial credit only." });
  if (hasCapTable && !capSummary) flags.push({ severity: "amber", label: "AI review pending", detail: "Cap table uploaded but not yet analysed — partial credit only." });

  const summaryText = incorpSummary ?? capSummary;
  const aiSummary = summaryText
    ? `Legal document summary: ${summaryText.slice(0, 300)}${summaryText.length > 300 ? "…" : ""}`
    : hasIncorp || hasCapTable
    ? "Legal documents uploaded. AI review pending — score is discounted."
    : "Both critical governance documents are missing. Score cannot exceed 5/12 until uploaded.";

  return { pts, max: 12, rating: rating(pts, 12), aiSummary, subScores, evidence, flags };
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

  const combinedSummary = [pitchSummary, bizSummary].filter(Boolean).join(" ");
  const hasTractionEvidence = containsKeywords(combinedSummary, ["traction", "revenue", "mrr", "arr", "growth", "paying", "contracts", "signed", "pilot", "customers", "%", "$", "million", "thousand"]);
  const hasBasicMarketWords = containsKeywords(combinedSummary, ["market", "customer", "users", "clients"]);
  const hasCompetitiveAnalysis = containsKeywords(combinedSummary, ["competitor", "competition", "vs ", "versus", "alternative", "differentiat", "market leader"]);

  const pitchPts = hasPitch
    ? (hasTractionEvidence ? 6 : hasBasicMarketWords ? 3 : pitchSummary ? 2 : 2)
    : 0;
  const bizPts = hasBizPlan
    ? (hasTractionEvidence ? 4 : bizSummary ? 2 : 1)
    : 0;
  const competitionPts = hasCompetitiveAnalysis ? 2 : 0;
  const industryPts = industry ? 1 : 0;

  const subScores: FactorSubScore[] = [
    { label: "Pitch deck with market evidence", pts: pitchPts, max: 6 },
    { label: "Business plan with market analysis", pts: bizPts, max: 4 },
    { label: "Competitive landscape acknowledged", pts: competitionPts, max: 2 },
    { label: "Industry declared", pts: industryPts, max: 1 },
  ];

  let pts = clamp(subScores.reduce((s, x) => s + x.pts, 0), 0, 13);
  if (!hasPitch && !hasBizPlan) pts = 0;
  else if (!pitchSummary && !bizSummary) pts = Math.min(pts, 4);
  else if (!hasTractionEvidence) pts = Math.min(pts, 8);

  const evidence: FactorEvidence[] = [];
  if (hasPitch) {
    evidence.push({ icon: hasTractionEvidence ? "✅" : pitchSummary ? "⚠️" : "⚠️", text: hasTractionEvidence ? "Pitch deck with specific traction metrics confirmed" : pitchSummary ? "Pitch deck — no specific traction data detected" : "Pitch deck uploaded — AI summary pending", src: "PITCH_DECK" });
  } else {
    evidence.push({ icon: "❌", text: "Pitch deck missing — market claims cannot be verified", src: "Document checklist" });
  }
  if (hasBizPlan) {
    evidence.push({ icon: hasTractionEvidence ? "✅" : "⚠️", text: hasTractionEvidence ? "Business plan references market metrics" : bizSummary ? "Business plan present — limited quantitative evidence" : "Business plan uploaded — AI summary pending", src: "BUSINESS_PLAN" });
  } else {
    evidence.push({ icon: "⚠️", text: "Business plan missing", src: "Document checklist" });
  }
  if (hasCompetitiveAnalysis) evidence.push({ icon: "✅", text: "Competitive landscape addressed in documents", src: "AI summaries" });
  else evidence.push({ icon: "⚠️", text: "No competitive analysis detected — investors expect competitors to be acknowledged", src: "AI summaries" });
  if (hasTractionEvidence) evidence.push({ icon: "✅", text: "Specific traction metrics or revenue figures found", src: "AI summaries" });

  const flags: FactorFlag[] = [];
  if (!hasPitch && !hasBizPlan) flags.push({ severity: "red", label: "No market documents", detail: "Score is 0 without a pitch deck or business plan." });
  else if (!hasTractionEvidence) flags.push({ severity: "red", label: "No traction evidence", detail: "No specific metrics, customer numbers, or revenue figures. Score capped at 8/13." });
  if (!hasCompetitiveAnalysis) flags.push({ severity: "amber", label: "No competitive analysis", detail: "Investors distrust founders who claim no competition. Acknowledge competitors and differentiate." });

  const aiSummary = pitchSummary ?? bizSummary
    ? `Market context: ${(pitchSummary ?? bizSummary ?? "").slice(0, 300)}…`
    : hasPitch || hasBizPlan
    ? "Market documents uploaded but AI summaries unavailable. Score heavily discounted."
    : "No market evidence documents found.";

  return { pts, max: 13, rating: rating(pts, 13), aiSummary, subScores, evidence, flags };
}

function scoreIpMoat(
  has: (t: string) => boolean,
  getSummary: (t: string) => string | null,
): FactorScore {
  const hasPitch = has("PITCH_DECK");
  const hasBizPlan = has("BUSINESS_PLAN");
  const hasIncorp = has("INCORPORATION_DOCS");
  const pitchSummary = getSummary("PITCH_DECK");
  const bizSummary = getSummary("BUSINESS_PLAN");
  const incorpSummary = getSummary("INCORPORATION_DOCS");

  const IP_HARD = ["patent", "trademark", "trade secret", "copyright", "intellectual property", "ip assignment", "exclusive license"];
  const IP_SOFT = ["proprietary", "proprietary technology", "unique technology", "licensed"];
  const MOAT_KEYWORDS = ["moat", "defensible", "network effect", "switching cost", "data advantage", "barrier to entry", "first mover", "exclusive"];

  const combinedSummary = [pitchSummary, bizSummary, incorpSummary].filter(Boolean).join(" ");

  const hasHardIp = containsKeywords(combinedSummary, IP_HARD);
  const hasSoftIp = containsKeywords(combinedSummary, IP_SOFT);
  const hasMoat = containsKeywords(combinedSummary, MOAT_KEYWORDS);
  const ipMatchCount = countKeywordMatches(combinedSummary, [...IP_HARD, ...IP_SOFT]);

  // IP evidence in summaries: 0–6
  const ipPts = hasHardIp ? (ipMatchCount >= 2 ? 6 : 5) : hasSoftIp ? 3 : 0;
  // Moat / defensibility: 0–3
  const moatPts = hasMoat ? 3 : hasSoftIp ? 1 : 0;
  // Formal IP documentation (incorporation docs referencing IP): 0–1
  const formalPts = hasIncorp && containsKeywords(incorpSummary, [...IP_HARD, "assignment"]) ? 1 : 0;

  const subScores: FactorSubScore[] = [
    { label: "IP evidence in documents", pts: ipPts, max: 6 },
    { label: "Competitive moat articulated", pts: moatPts, max: 3 },
    { label: "Formal IP documentation", pts: formalPts, max: 1 },
  ];

  let pts = clamp(subScores.reduce((s, x) => s + x.pts, 0), 0, 10);
  // No docs at all = 0; docs but no summaries = max 2
  if (!hasPitch && !hasBizPlan) pts = Math.min(pts, 1);
  else if (!pitchSummary && !bizSummary) pts = Math.min(pts, 2);

  const evidence: FactorEvidence[] = [];
  if (hasHardIp) evidence.push({ icon: "✅", text: `Strong IP evidence: patents, trademarks, or trade secrets referenced`, src: "AI summaries" });
  else if (hasSoftIp) evidence.push({ icon: "⚠️", text: "Proprietary technology mentioned — no formal IP (patents/trademarks) detected", src: "AI summaries" });
  else evidence.push({ icon: "❌", text: "No IP or proprietary technology referenced in documents", src: "AI summaries" });

  if (hasMoat) evidence.push({ icon: "✅", text: "Competitive moat or defensibility strategy articulated", src: "AI summaries" });
  else evidence.push({ icon: "⚠️", text: "No moat or defensibility strategy detected — investors will probe this heavily", src: "AI summaries" });

  if (formalPts) evidence.push({ icon: "✅", text: "IP assignment or formal IP referenced in legal documents", src: "INCORPORATION_DOCS" });
  if (!hasPitch && !hasBizPlan) evidence.push({ icon: "❌", text: "No documents uploaded to assess IP", src: "Document checklist" });

  const flags: FactorFlag[] = [];
  if (!hasHardIp && !hasSoftIp) flags.push({ severity: "red", label: "No IP evidence", detail: "No patents, trademarks, or proprietary technology referenced. Investors need to know the business is defensible." });
  else if (!hasHardIp) flags.push({ severity: "amber", label: "Weak IP", detail: "Proprietary language detected but no formal IP (patents, trademarks). File IP protection to strengthen this factor." });
  if (!hasMoat) flags.push({ severity: "amber", label: "No moat articulated", detail: "No clear competitive moat described. Include network effects, switching costs, or data advantages in your pitch." });

  const aiSummary = hasHardIp
    ? `Formal IP evidence found in documents. ${hasMoat ? "Competitive moat is articulated." : "No moat strategy described."}`
    : hasSoftIp
    ? "Proprietary technology referenced but no formal IP protection documented. Consider patenting or trademarking key innovations."
    : hasPitch || hasBizPlan
    ? "Documents uploaded but no IP or proprietary technology references found in summaries. This is a significant investor concern — add IP context to your pitch."
    : "No documents uploaded. IP and competitive moat cannot be assessed.";

  return { pts, max: 10, rating: rating(pts, 10), aiSummary, subScores, evidence, flags };
}

function scoreBurnRunway(
  has: (t: string) => boolean,
  getSummary: (t: string) => string | null,
  fundingAmount: number | null,
  revenueStage: string | null,
): FactorScore {
  const hasFinancials = has("FINANCIAL_STATEMENTS");
  const hasBizPlan = has("BUSINESS_PLAN");
  const financialSummary = getSummary("FINANCIAL_STATEMENTS");
  const bizSummary = getSummary("BUSINESS_PLAN");

  const BURN_KEYWORDS = ["burn", "runway", "monthly spend", "operating expenses", "cash negative", "cash flow negative", "rate of spend", "monthly cost"];
  const RUNWAY_KEYWORDS = ["runway", "months of cash", "12 months", "18 months", "24 months", "sufficient cash", "fund operations", "extend runway"];
  const POSITIVE_CASHFLOW = ["cash flow positive", "profitable", "self-sustaining", "break-even", "breakeven", "positive margin"];

  const combinedSummary = [financialSummary, bizSummary].filter(Boolean).join(" ");
  const hasBurnData = containsKeywords(combinedSummary, BURN_KEYWORDS);
  const hasRunwayData = containsKeywords(combinedSummary, RUNWAY_KEYWORDS);
  const isPositiveCashflow = containsKeywords(combinedSummary, POSITIVE_CASHFLOW);

  // Financials with burn/runway analysis: 0–6
  const financialPts = hasFinancials
    ? isPositiveCashflow ? 6
      : hasBurnData || hasRunwayData ? 6
      : financialSummary ? 4
      : 3
    : 0;

  // Biz plan with runway projection: 0–3
  const bizPts = hasBizPlan
    ? (hasRunwayData ? 3 : bizSummary ? 1 : 1)
    : 0;

  // Funding target as proxy for runway awareness: 0–1
  const fundingPts = fundingAmount ? 1 : 0;

  const subScores: FactorSubScore[] = [
    { label: "Financial statements with burn analysis", pts: financialPts, max: 6 },
    { label: "Business plan with runway projection", pts: bizPts, max: 3 },
    { label: "Funding target declared", pts: fundingPts, max: 1 },
  ];

  // Hard caps
  let pts = clamp(subScores.reduce((s, x) => s + x.pts, 0), 0, 10);
  if (!hasFinancials) pts = Math.min(pts, 3);
  if (hasFinancials && !financialSummary) pts = Math.min(pts, 5);

  const isPreRevenue = revenueStage?.toLowerCase().includes("pre") ?? false;

  const evidence: FactorEvidence[] = [];
  if (hasFinancials) {
    if (isPositiveCashflow) {
      evidence.push({ icon: "✅", text: "Company appears cash flow positive or near break-even", src: "FINANCIAL_STATEMENTS" });
    } else if (hasBurnData) {
      evidence.push({ icon: "✅", text: "Burn rate or runway data found in financial analysis", src: "FINANCIAL_STATEMENTS" });
    } else if (financialSummary) {
      evidence.push({ icon: "⚠️", text: "Financial statements reviewed — no explicit burn/runway figures identified", src: "FINANCIAL_STATEMENTS" });
    } else {
      evidence.push({ icon: "⚠️", text: "Financial statements uploaded — AI review pending (partial credit)", src: "FINANCIAL_STATEMENTS" });
    }
  } else {
    evidence.push({ icon: "❌", text: "Financial statements missing — burn rate and runway unknown. Score capped at 3/10.", src: "Document checklist" });
  }
  if (hasBizPlan) {
    evidence.push({ icon: hasRunwayData ? "✅" : "⚠️", text: hasRunwayData ? "Business plan includes runway projections" : "Business plan present — no runway projections detected", src: "BUSINESS_PLAN" });
  } else {
    evidence.push({ icon: "⚠️", text: "Business plan missing — runway projections unverifiable", src: "Document checklist" });
  }
  if (isPreRevenue && !hasFinancials) evidence.push({ icon: "❌", text: "Pre-revenue company with no financial statements — runway completely unknown", src: "Risk assessment" });

  const flags: FactorFlag[] = [];
  if (!hasFinancials) flags.push({ severity: "red", label: "No financial statements", detail: "Burn rate and runway are critical investor questions. Without financials, this factor is capped at 3/10. This is a deal-breaker for most investors." });
  else if (!hasBurnData && !hasRunwayData && !isPositiveCashflow) flags.push({ severity: "amber", label: "No burn/runway data", detail: "Financial statements uploaded but no explicit burn rate or runway figures found. Ensure your financials clearly state monthly burn and cash runway." });
  if (!hasBizPlan) flags.push({ severity: "amber", label: "No runway projections", detail: "A business plan with a 12-24 month cash runway projection is expected by investors." });
  if (isPreRevenue && !hasFinancials) flags.push({ severity: "red", label: "Unknown runway", detail: "Pre-revenue with no financials = investors cannot assess survival risk. This is a critical gap." });

  const summaryText = financialSummary ?? bizSummary;
  const aiSummary = summaryText
    ? `Burn/runway context: ${summaryText.slice(0, 300)}${summaryText.length > 300 ? "…" : ""}`
    : hasFinancials || hasBizPlan
    ? "Financial documents uploaded but AI summaries not yet generated. Score discounted until available."
    : "No financial documents uploaded. Burn rate and runway cannot be assessed — a critical investor concern.";

  return { pts, max: 10, rating: rating(pts, 10), aiSummary, subScores, evidence, flags };
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
    { label: "Pitch deck (+ AI review)", pts: hasPitch ? (pitchSummary ? 4 : 2) : 0, max: 4 },
    { label: "Business plan (+ AI review)", pts: hasBizPlan ? (bizSummary ? 3 : 1) : 0, max: 3 },
    { label: "Both docs with AI summaries", pts: hasSummaries && hasPitch && hasBizPlan ? 1 : 0, max: 1 },
  ];

  const pts = clamp(subScores.reduce((s, x) => s + x.pts, 0), 0, 8);

  const evidence: FactorEvidence[] = [];
  if (hasPitch) evidence.push({ icon: "✅", text: pitchSummary ? "Pitch deck uploaded and AI-reviewed" : "Pitch deck uploaded — AI review pending (partial credit)", src: "PITCH_DECK" });
  else evidence.push({ icon: "❌", text: "Pitch deck not uploaded", src: "Document checklist" });
  if (hasBizPlan) evidence.push({ icon: "✅", text: bizSummary ? "Business plan uploaded and AI-reviewed" : "Business plan uploaded — AI review pending (partial credit)", src: "BUSINESS_PLAN" });
  else evidence.push({ icon: "❌", text: "Business plan not uploaded", src: "Document checklist" });
  if (hasSummaries) evidence.push({ icon: "✅", text: "AI summaries available — full credit unlocked", src: "AI summaries" });
  else if (hasPitch || hasBizPlan) evidence.push({ icon: "⚠️", text: "Documents uploaded but AI summaries not yet generated — score discounted", src: "AI summaries" });

  const flags: FactorFlag[] = [];
  if (!hasPitch) flags.push({ severity: "red", label: "No pitch deck", detail: "A pitch deck is the core investor communication document." });
  if (!hasBizPlan) flags.push({ severity: "red", label: "No business plan", detail: "A business plan demonstrates depth and planning maturity." });
  if ((hasPitch || hasBizPlan) && !hasSummaries) flags.push({ severity: "amber", label: "AI review pending", detail: "Documents uploaded but no AI summaries yet. Score heavily discounted." });

  const aiSummary = pitchSummary
    ? `Pitch deck summary: ${pitchSummary.slice(0, 300)}${pitchSummary.length > 300 ? "…" : ""}`
    : bizSummary
    ? `Business plan summary: ${bizSummary.slice(0, 300)}${bizSummary.length > 300 ? "…" : ""}`
    : hasPitch || hasBizPlan
    ? "Documents uploaded. AI summaries pending — score reflects document presence only."
    : "No pitch or business plan uploaded.";

  return { pts, max: 8, rating: rating(pts, 8), aiSummary, subScores, evidence, flags };
}

function scoreDealStructure(
  has: (t: string) => boolean,
  getSummary: (t: string) => string | null,
  fundingAmount: number | null,
  revenueStage: string | null,
): FactorScore {
  const hasBizPlan = has("BUSINESS_PLAN");
  const hasPitch = has("PITCH_DECK");
  const bizSummary = getSummary("BUSINESS_PLAN");
  const pitchSummary = getSummary("PITCH_DECK");

  const combinedSummary = [bizSummary, pitchSummary].filter(Boolean).join(" ");
  const hasDealKeywords = containsKeywords(combinedSummary, ["equity", "valuation", "term", "convertible", "safe", "priced round", "deal", "structure"]);
  const hasUseOfFunds = containsKeywords(combinedSummary, ["use of funds", "allocation", "% ", "hiring", "marketing", "r&d", "product development", "operations budget", "proceeds"]);

  const subScores: FactorSubScore[] = [
    { label: "Funding amount declared", pts: fundingAmount ? 2 : 0, max: 2 },
    { label: "Deal structure terms in docs", pts: hasDealKeywords ? 3 : hasBizPlan || hasPitch ? 1 : 0, max: 3 },
    { label: "Use of funds breakdown", pts: hasUseOfFunds ? 2 : 0, max: 2 },
    { label: "Stage appropriate for raise", pts: revenueStage ? 1 : 0, max: 1 },
  ];

  const pts = clamp(subScores.reduce((s, x) => s + x.pts, 0), 0, 8);

  const evidence: FactorEvidence[] = [];
  if (fundingAmount) evidence.push({ icon: "✅", text: `Raise target: $${fundingAmount.toLocaleString()}`, src: "Company profile" });
  else evidence.push({ icon: "⚠️", text: "Funding amount not declared", src: "Company profile" });
  if (hasDealKeywords) evidence.push({ icon: "✅", text: "Deal structure terms referenced (equity, SAFE, valuation, etc.)", src: "AI summaries" });
  else evidence.push({ icon: "⚠️", text: "No deal structure terms detected in documents", src: "AI summaries" });
  if (hasUseOfFunds) evidence.push({ icon: "✅", text: "Use of funds breakdown found in documents", src: "AI summaries" });
  else evidence.push({ icon: "⚠️", text: "No use of funds breakdown detected — investors expect specificity", src: "AI summaries" });

  const flags: FactorFlag[] = [];
  if (!fundingAmount) flags.push({ severity: "amber", label: "No funding target", detail: "Investors need to know the raise size and minimum investment to assess fit." });
  if (!hasUseOfFunds) flags.push({ severity: "amber", label: "No use of funds", detail: "Vague use of funds ('grow the business') is a red flag. Break it down by category with percentages." });
  if (!hasDealKeywords) flags.push({ severity: "amber", label: "No deal terms", detail: "Upload a business plan with equity structure, valuation, and deal terms." });

  const aiSummary = bizSummary
    ? `Deal context: ${bizSummary.slice(0, 300)}${bizSummary.length > 300 ? "…" : ""}`
    : hasBizPlan
    ? "Business plan uploaded. AI summary pending."
    : "No deal structure documents found. Declare funding amount and upload a business plan with specific use of funds.";

  return { pts, max: 8, rating: rating(pts, 8), aiSummary, subScores, evidence, flags };
}

function scoreIndustryAlignment(
  industry: string | null,
  revenueStage: string | null,
): FactorScore {
  const FOCUS_INDUSTRIES = ["fintech", "healthtech", "edtech", "cleantech", "proptech", "agritech", "saas", "technology", "finance", "health", "software", "medtech", "insurtech"];
  const industryMatch = industry ? FOCUS_INDUSTRIES.some((f) => industry.toLowerCase().includes(f)) : false;

  const subScores: FactorSubScore[] = [
    { label: "Industry in platform focus areas", pts: industryMatch ? 2 : industry ? 1 : 0, max: 2 },
    { label: "Stage declared", pts: revenueStage ? 1 : 0, max: 1 },
  ];

  const pts = clamp(subScores.reduce((s, x) => s + x.pts, 0), 0, 3);

  const evidence: FactorEvidence[] = [];
  if (industry) {
    evidence.push({ icon: industryMatch ? "✅" : "⚠️", text: industryMatch ? `Industry: ${industry} — matches platform focus areas` : `Industry: ${industry} — outside platform focus (1/2 pts)`, src: "Company profile" });
  } else {
    evidence.push({ icon: "❌", text: "Industry not declared", src: "Company profile" });
  }
  if (revenueStage) evidence.push({ icon: "✅", text: `Stage: ${revenueStage}`, src: "Company profile" });
  else evidence.push({ icon: "⚠️", text: "Revenue stage not set", src: "Company profile" });

  const flags: FactorFlag[] = [];
  if (!industry) flags.push({ severity: "amber", label: "No industry set", detail: "Declare your industry to enable alignment scoring." });
  else if (!industryMatch) flags.push({ severity: "amber", label: "Outside focus areas", detail: `${industry} is outside platform focus industries. Only 1/2 pts for industry alignment.` });

  const aiSummary = industry && revenueStage
    ? `${industry} at ${revenueStage} stage. Platform focuses on tech-enabled, scalable ventures.`
    : industry
    ? `Industry: ${industry}. Revenue stage not set.`
    : "Industry and stage not declared. Complete your company profile.";

  return { pts, max: 3, rating: rating(pts, 3), aiSummary, subScores, evidence, flags };
}

function scoreImpactEsg(
  has: (t: string) => boolean,
  getSummary: (t: string) => string | null,
): FactorScore {
  const ESG_KEYWORDS = ["impact", "esg", "sustainability", "environment", "social", "governance", "sdg", "carbon", "community", "diversity", "inclusion", "green", "climate"];
  const allSummaries = ["PITCH_DECK", "BUSINESS_PLAN", "FINANCIAL_STATEMENTS"]
    .map((t) => getSummary(t))
    .filter(Boolean)
    .join(" ");

  const hasEsgKeywords = containsKeywords(allSummaries, ESG_KEYWORDS);
  const hasPitch = has("PITCH_DECK");
  const hasBizPlan = has("BUSINESS_PLAN");

  const subScores: FactorSubScore[] = [
    { label: "ESG/impact keywords in docs", pts: hasEsgKeywords ? 2 : 0, max: 2 },
    { label: "Core documents present", pts: hasPitch && hasBizPlan ? 1 : 0, max: 1 },
  ];

  const pts = clamp(subScores.reduce((s, x) => s + x.pts, 0), 0, 3);

  const evidence: FactorEvidence[] = [];
  if (hasEsgKeywords) evidence.push({ icon: "✅", text: "Impact or ESG references found in document summaries", src: "AI summaries" });
  else evidence.push({ icon: "⚠️", text: "No ESG or impact keywords found", src: "AI summaries" });

  const flags: FactorFlag[] = [];
  if (!hasEsgKeywords) flags.push({ severity: "amber", label: "No ESG evidence", detail: "Consider adding an impact statement or ESG section. Increasingly important for impact-focused investors." });

  const aiSummary = hasEsgKeywords
    ? "Document summaries reference impact or ESG-related themes."
    : "No explicit ESG or impact references found. This is informational — a low score here does not exclude investors.";

  return { pts, max: 3, rating: rating(pts, 3), aiSummary, subScores, evidence, flags };
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
    founder_team:       scoreFounderTeam(has, getSummary, input.companyName, input.industry),
    governance_legal:   scoreGovernanceLegal(has, getSummary, input.industry),
    market_evidence:    scoreMarketEvidence(has, getSummary, input.industry),
    ip_moat:            scoreIpMoat(has, getSummary),
    burn_runway:        scoreBurnRunway(has, getSummary, input.fundingAmount, input.revenueStage),
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
