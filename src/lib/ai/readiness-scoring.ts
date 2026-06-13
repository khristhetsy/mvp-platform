/**
 * Investable Readiness Scoring — rule-based engine v3
 *
 * 13 factors, 100 pts total. Scored from uploaded document metadata
 * and existing AI summaries. No external API required.
 *
 * IMPORTANT: Score is investor/admin-only — never surfaced to founders.
 */

// ─── Factor definitions ──────────────────────────────────────────────────────

export const READINESS_FACTORS = [
  { key: "revenue_cashflow",   label: "Revenue & Cash Flow Trajectory",        max: 15, tag: "Financial"   },
  { key: "customer_traction",  label: "Customer Traction & LOIs",              max: 13, tag: "Traction"    },
  { key: "founder_team",       label: "Founder Integrity & Team Depth",         max: 11, tag: "Team"        },
  { key: "market_evidence",    label: "Market & Competitive Evidence",          max: 10, tag: "Market"      },
  { key: "unit_economics",     label: "Unit Economics & Scalability",           max: 10, tag: "Economics"   },
  { key: "governance_legal",   label: "Governance & Legal Cleanliness",         max: 9,  tag: "Legal"       },
  { key: "ip_moat",            label: "IP Protection & Competitive Moat",       max: 8,  tag: "Moat"        },
  { key: "burn_runway",        label: "Burn Rate & Runway",                     max: 8,  tag: "Financial"   },
  { key: "exit_strategy",      label: "Exit Strategy & Investor Returns",       max: 7,  tag: "Strategy"    },
  { key: "pitch_quality",      label: "Pitch Deck & Business Plan Quality",     max: 4,  tag: "Documents"   },
  { key: "deal_structure",     label: "Deal Structure & Use of Funds",          max: 3,  tag: "Deal Terms"  },
  { key: "industry_alignment", label: "Industry & Stage Alignment",             max: 1,  tag: "Fit"         },
  { key: "impact_esg",         label: "Impact / ESG Alignment",                 max: 1,  tag: "ESG"         },
] as const;

// Sanity check: 15+13+11+10+10+9+8+8+7+4+3+1+1 = 100 ✓
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

  return { pts, max: 15, rating: rating(pts, 15), aiSummary, subScores, evidence, flags };
}

function scoreCustomerTraction(
  has: (t: string) => boolean,
  getSummary: (t: string) => string | null,
  revenueStage: string | null,
): FactorScore {
  const hasPitch = has("PITCH_DECK");
  const hasBizPlan = has("BUSINESS_PLAN");
  const hasFinancials = has("FINANCIAL_STATEMENTS");
  const pitchSummary = getSummary("PITCH_DECK");
  const bizSummary = getSummary("BUSINESS_PLAN");
  const financialSummary = getSummary("FINANCIAL_STATEMENTS");

  const combinedSummary = [pitchSummary, bizSummary, financialSummary].filter(Boolean).join(" ");

  const LOI_KEYWORDS = ["letter of intent", "loi", "signed contract", "purchase order", "pilot agreement", "master service agreement", "msa", "committed", "binding"];
  const PAYING_KEYWORDS = ["paying customer", "paid customer", "revenue from", "annual contract", "arr", "mrr", "monthly recurring", "annual recurring", "subscription"];
  const GENERAL_CUSTOMER = ["customer", "users", "clients", "accounts", "traction", "adoption", "retention", "churn", "nps"];
  const METRIC_KEYWORDS = ["%", "$", "thousand", "million", "k users", "k customers", "growth", "month-over-month", "mom", "yoy", "year-over-year"];

  const hasLoi = containsKeywords(combinedSummary, LOI_KEYWORDS);
  const hasPayingCustomers = containsKeywords(combinedSummary, PAYING_KEYWORDS);
  const hasGeneralCustomers = containsKeywords(combinedSummary, GENERAL_CUSTOMER);
  const hasMetrics = containsKeywords(combinedSummary, METRIC_KEYWORDS);
  const isPreRevenue = revenueStage?.toLowerCase().includes("pre") ?? false;

  // LOI / contract evidence: 0–6
  const loiPts = hasLoi ? 6 : hasPayingCustomers ? 4 : hasGeneralCustomers ? 2 : 0;
  // Revenue / MRR figures: 0–4
  const revPts = hasPayingCustomers && hasMetrics ? 4 : hasPayingCustomers ? 2 : hasMetrics ? 1 : 0;
  // Retention / growth metrics: 0–3
  const metricPts = hasMetrics && hasGeneralCustomers ? (hasLoi || hasPayingCustomers ? 3 : 2) : 0;

  const subScores: FactorSubScore[] = [
    { label: "LOIs / signed contracts / pilots", pts: loiPts, max: 6 },
    { label: "MRR / ARR / revenue figures", pts: revPts, max: 4 },
    { label: "Retention / growth metrics", pts: metricPts, max: 3 },
  ];

  let pts = clamp(subScores.reduce((s, x) => s + x.pts, 0), 0, 13);
  if (!hasPitch && !hasBizPlan && !hasFinancials) pts = 0;
  else if (!pitchSummary && !bizSummary && !financialSummary) pts = Math.min(pts, 2);
  else if (isPreRevenue && !hasLoi) pts = Math.min(pts, 5); // pre-revenue without LOIs capped

  const evidence: FactorEvidence[] = [];
  if (hasLoi) evidence.push({ icon: "✅", text: "Letters of Intent, signed contracts, or pilot agreements referenced — strongest possible traction signal", src: "AI summaries" });
  else if (hasPayingCustomers) evidence.push({ icon: "✅", text: "Paying customers or recurring revenue (MRR/ARR) confirmed", src: "AI summaries" });
  else if (hasGeneralCustomers) evidence.push({ icon: "⚠️", text: "Customer or user references found — no paying customers or LOIs confirmed", src: "AI summaries" });
  else evidence.push({ icon: "❌", text: "No customer traction evidence found in documents", src: "AI summaries" });

  if (hasMetrics) evidence.push({ icon: "✅", text: "Specific traction metrics (numbers, percentages, growth rates) found", src: "AI summaries" });
  else evidence.push({ icon: "⚠️", text: "No specific traction metrics — investors expect numbers, not narratives", src: "AI summaries" });

  if (isPreRevenue && !hasLoi) evidence.push({ icon: "⚠️", text: "Pre-revenue company — LOIs or pilots are critical to demonstrate demand", src: "Risk assessment" });

  const flags: FactorFlag[] = [];
  if (!hasGeneralCustomers && !hasLoi) flags.push({ severity: "red", label: "No customer evidence", detail: "No customer, user, or traction evidence found. This is the question every investor asks first. Upload pitch or biz plan with customer data." });
  else if (!hasPayingCustomers && !hasLoi) flags.push({ severity: "amber", label: "No paying customers or LOIs", detail: "User/customer references found but no paying customers or signed LOIs. These are table stakes for most investors." });
  if (!hasMetrics) flags.push({ severity: "amber", label: "No traction metrics", detail: "Replace narrative language ('strong growth') with numbers (e.g. '120 paying customers, 15% MoM growth')." });
  if (isPreRevenue && !hasLoi) flags.push({ severity: "red", label: "Pre-revenue without LOIs", detail: "For pre-revenue companies, signed LOIs or pilot agreements are the minimum acceptable evidence of demand." });

  const aiSummary = hasLoi
    ? "Strong: signed LOIs or contracts referenced — real demand confirmed."
    : hasPayingCustomers
    ? "Paying customers or recurring revenue confirmed in documents."
    : hasGeneralCustomers
    ? "Customer references found but no confirmed paying customers or LOIs."
    : hasPitch || hasBizPlan
    ? "Documents uploaded but no customer traction found in summaries. Add customer evidence to your pitch."
    : "No documents uploaded. Customer traction cannot be assessed.";

  return { pts, max: 13, rating: rating(pts, 13), aiSummary, subScores, evidence, flags };
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

  return { pts, max: 11, rating: rating(pts, 11), aiSummary, subScores, evidence, flags };
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

  const incorpPts = hasIncorp ? (incorpSummary ? 5 : 2) : 0;
  const capPts = hasCapTable ? (capSummary ? 3 : 1) : 0;
  const profilePts = industry ? 1 : 0;

  const subScores: FactorSubScore[] = [
    { label: "Incorporation docs (+ AI review)", pts: incorpPts, max: 5 },
    { label: "Cap table (+ AI review)", pts: capPts, max: 3 },
    { label: "Company profile (industry set)", pts: profilePts, max: 1 },
  ];

  // Hard cap: missing either = max 4
  let pts = clamp(subScores.reduce((s, x) => s + x.pts, 0), 0, 9);
  if (!hasIncorp || !hasCapTable) pts = Math.min(pts, 4);

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

  return { pts, max: 9, rating: rating(pts, 9), aiSummary, subScores, evidence, flags };
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

  return { pts, max: 10, rating: rating(pts, 10), aiSummary, subScores, evidence, flags };
}

function scoreUnitEconomics(
  has: (t: string) => boolean,
  getSummary: (t: string) => string | null,
  revenueStage: string | null,
): FactorScore {
  const hasFinancials = has("FINANCIAL_STATEMENTS");
  const hasBizPlan = has("BUSINESS_PLAN");
  const hasPitch = has("PITCH_DECK");
  const financialSummary = getSummary("FINANCIAL_STATEMENTS");
  const bizSummary = getSummary("BUSINESS_PLAN");
  const pitchSummary = getSummary("PITCH_DECK");

  const combinedSummary = [financialSummary, bizSummary, pitchSummary].filter(Boolean).join(" ");

  const UNIT_ECON_KEYWORDS = ["ltv", "cac", "lifetime value", "customer acquisition cost", "unit economics", "payback period", "contribution margin", "arpu", "average revenue per user", "revenue per customer"];
  const MARGIN_KEYWORDS = ["gross margin", "gross profit", "cogs", "cost of goods", "cost of revenue", "net margin", "ebitda", "operating margin"];
  const SCALE_KEYWORDS = ["economies of scale", "margins improving", "margin expansion", "scalable", "leverage", "fixed cost", "variable cost", "breakeven", "break-even", "profitable at scale"];

  const hasUnitEcon = containsKeywords(combinedSummary, UNIT_ECON_KEYWORDS);
  const hasMargins = containsKeywords(combinedSummary, MARGIN_KEYWORDS);
  const hasScaleEvidence = containsKeywords(combinedSummary, SCALE_KEYWORDS);
  const isPreRevenue = revenueStage?.toLowerCase().includes("pre") ?? false;

  // Unit economics explicitly mentioned: 0–5
  const unitPts = hasUnitEcon ? 5 : hasMargins ? 3 : 0;
  // Gross margin present: 0–3
  const marginPts = hasMargins ? (financialSummary ? 3 : 2) : hasFinancials ? 1 : 0;
  // Scalability evidence: 0–2
  const scalePts = hasScaleEvidence ? 2 : 0;

  const subScores: FactorSubScore[] = [
    { label: "LTV / CAC / unit economics stated", pts: unitPts, max: 5 },
    { label: "Gross margin data present", pts: marginPts, max: 3 },
    { label: "Scalability / margin improvement", pts: scalePts, max: 2 },
  ];

  let pts = clamp(subScores.reduce((s, x) => s + x.pts, 0), 0, 10);
  if (!hasFinancials && !hasBizPlan && !hasPitch) pts = 0;
  else if (!financialSummary && !bizSummary && !pitchSummary) pts = Math.min(pts, 1);
  else if (!hasUnitEcon && !hasMargins) pts = Math.min(pts, 3);
  // Pre-revenue: unit economics are projections, not actuals — partial cap
  if (isPreRevenue && !hasUnitEcon) pts = Math.min(pts, 4);

  const evidence: FactorEvidence[] = [];
  if (hasUnitEcon) evidence.push({ icon: "✅", text: "Unit economics (LTV, CAC, payback period) explicitly stated — strong investor signal", src: "AI summaries" });
  else if (hasMargins) evidence.push({ icon: "⚠️", text: "Gross margin data found — unit economics (LTV/CAC) not explicitly stated", src: "AI summaries" });
  else evidence.push({ icon: "❌", text: "No unit economics or margin data found — investors need to know the business model works at scale", src: "AI summaries" });

  if (hasScaleEvidence) evidence.push({ icon: "✅", text: "Scalability or margin improvement trajectory described", src: "AI summaries" });
  else evidence.push({ icon: "⚠️", text: "No scalability narrative found", src: "AI summaries" });

  if (hasFinancials) evidence.push({ icon: "✅", text: financialSummary ? "Financial statements with margin data reviewed" : "Financial statements uploaded — AI review pending", src: "FINANCIAL_STATEMENTS" });
  else evidence.push({ icon: "⚠️", text: "No financial statements — unit economics derived from projections only", src: "Document checklist" });

  if (isPreRevenue) evidence.push({ icon: "⚠️", text: "Pre-revenue company — unit economics are projections, not actuals. Investors will discount accordingly.", src: "Risk assessment" });

  const flags: FactorFlag[] = [];
  if (!hasUnitEcon && !hasMargins) flags.push({ severity: "red", label: "No unit economics", detail: "LTV:CAC ratio and gross margin are fundamental business model metrics. Include them in your pitch or business plan." });
  else if (!hasUnitEcon) flags.push({ severity: "amber", label: "No LTV/CAC stated", detail: "Gross margin found but LTV:CAC ratio not stated. This ratio is the most-asked unit economics question from investors." });
  if (!hasScaleEvidence) flags.push({ severity: "amber", label: "No scalability narrative", detail: "Describe how margins improve as the company scales. Fixed vs. variable cost structure helps investors model returns." });
  if (isPreRevenue) flags.push({ severity: "amber", label: "Pre-revenue projections only", detail: "Unit economics are projections, not actuals. Investors will apply a significant discount — include assumptions clearly." });

  const aiSummary = hasUnitEcon
    ? `Unit economics data found: ${(financialSummary ?? bizSummary ?? pitchSummary ?? "").slice(0, 250)}…`
    : hasMargins
    ? "Gross margin data present but LTV/CAC not explicitly stated. Add unit economics to strengthen investor confidence."
    : hasFinancials || hasBizPlan
    ? "Financial documents uploaded but no unit economics or margin data found in summaries. Add LTV, CAC, and gross margin figures."
    : "No documents uploaded. Unit economics cannot be assessed.";

  return { pts, max: 10, rating: rating(pts, 10), aiSummary, subScores, evidence, flags };
}

function scoreIpMoat(
  has: (t: string) => boolean,
  getSummary: (t: string) => string | null,
  industry: string | null,
): FactorScore {
  const hasPitch = has("PITCH_DECK");
  const hasBizPlan = has("BUSINESS_PLAN");
  const hasIncorp = has("INCORPORATION_DOCS");
  const pitchSummary = getSummary("PITCH_DECK");
  const bizSummary = getSummary("BUSINESS_PLAN");
  const incorpSummary = getSummary("INCORPORATION_DOCS");

  const combinedSummary = [pitchSummary, bizSummary, incorpSummary].filter(Boolean).join(" ");

  // Determine if this is a software/digital industry where patents are not the norm
  const SOFTWARE_INDUSTRIES = ["saas", "software", "fintech", "edtech", "marketplace", "platform", "app", "digital", "insurtech", "proptech"];
  const PATENT_INDUSTRIES = ["medtech", "healthtech", "biotech", "hardware", "manufacturing", "cleantech", "agritech", "pharmaceutical", "medical device", "energy"];
  const isSoftwareIndustry = industry ? SOFTWARE_INDUSTRIES.some((s) => industry.toLowerCase().includes(s)) : false;
  const isPatentIndustry = industry ? PATENT_INDUSTRIES.some((s) => industry.toLowerCase().includes(s)) : false;

  // Formal IP: patents, trademarks, trade secrets — expected in hardware/biotech, optional in SaaS
  const IP_FORMAL = ["patent", "trademark", "trade secret", "copyright", "ip assignment", "exclusive license", "intellectual property"];
  // Software/digital moat signals — primary for SaaS
  const IP_SOFTWARE = ["proprietary", "proprietary technology", "proprietary algorithm", "proprietary data", "codebase", "trade secret", "licensed technology"];
  // Moat / defensibility signals — relevant for all industries
  const MOAT_ALL = ["moat", "defensible", "network effect", "switching cost", "data advantage", "barrier to entry", "first mover", "exclusive", "lock-in", "retention", "sticky", "churn"];

  const hasFormalIp = containsKeywords(combinedSummary, IP_FORMAL);
  const hasSoftwareIp = containsKeywords(combinedSummary, IP_SOFTWARE);
  const hasMoat = containsKeywords(combinedSummary, MOAT_ALL);
  const formalMatchCount = countKeywordMatches(combinedSummary, IP_FORMAL);

  let ipPts: number;
  let moatPts: number;
  let formalPts: number;
  let ipLabel: string;
  let ipMax: number;

  if (isSoftwareIndustry) {
    // SaaS/software: proprietary tech + moat signals are primary; patents not required
    ipLabel = "Proprietary tech / data assets";
    ipMax = 6;
    ipPts = hasFormalIp ? 6 : hasSoftwareIp ? 5 : 0; // proprietary code = full credit
    moatPts = hasMoat ? 3 : hasSoftwareIp ? 1 : 0;
    formalPts = hasIncorp && containsKeywords(incorpSummary, [...IP_FORMAL, "assignment"]) ? 1 : 0;
  } else if (isPatentIndustry) {
    // Hardware/biotech: formal IP (patents) is critical, not optional
    ipLabel = "Patents / formal IP protection";
    ipMax = 6;
    ipPts = hasFormalIp ? (formalMatchCount >= 2 ? 6 : 5) : hasSoftwareIp ? 2 : 0;
    moatPts = hasMoat ? 3 : hasSoftwareIp ? 1 : 0;
    formalPts = hasIncorp && containsKeywords(incorpSummary, [...IP_FORMAL, "assignment"]) ? 1 : 0;
  } else {
    // Unknown industry: give credit for either formal IP or proprietary signals
    ipLabel = "IP evidence in documents";
    ipMax = 6;
    ipPts = hasFormalIp ? (formalMatchCount >= 2 ? 6 : 5) : hasSoftwareIp ? 4 : 0;
    moatPts = hasMoat ? 3 : hasSoftwareIp ? 1 : 0;
    formalPts = hasIncorp && containsKeywords(incorpSummary, [...IP_FORMAL, "assignment"]) ? 1 : 0;
  }

  const subScores: FactorSubScore[] = [
    { label: ipLabel, pts: ipPts, max: ipMax },
    { label: "Competitive moat articulated", pts: moatPts, max: 3 },
    { label: "IP / ownership documented legally", pts: formalPts, max: 1 },
  ];

  let pts = clamp(subScores.reduce((s, x) => s + x.pts, 0), 0, 10);
  if (!hasPitch && !hasBizPlan) pts = Math.min(pts, 1);
  else if (!pitchSummary && !bizSummary) pts = Math.min(pts, 2);

  const evidence: FactorEvidence[] = [];
  if (isSoftwareIndustry) {
    // Software-specific evidence messaging
    if (hasFormalIp) evidence.push({ icon: "✅", text: "Formal IP (patents/trademarks) referenced — strong for a software company", src: "AI summaries" });
    else if (hasSoftwareIp) evidence.push({ icon: "✅", text: "Proprietary technology or data assets referenced — appropriate for SaaS/software", src: "AI summaries" });
    else evidence.push({ icon: "⚠️", text: "No proprietary technology or data assets mentioned — describe what makes the software defensible", src: "AI summaries" });
  } else if (isPatentIndustry) {
    if (hasFormalIp) evidence.push({ icon: "✅", text: "Patents or formal IP protection referenced — critical for this industry", src: "AI summaries" });
    else evidence.push({ icon: "❌", text: "No patents or formal IP found — expected for hardware/biotech/medtech companies", src: "AI summaries" });
  } else {
    if (hasFormalIp) evidence.push({ icon: "✅", text: "Formal IP (patents, trademarks, trade secrets) referenced", src: "AI summaries" });
    else if (hasSoftwareIp) evidence.push({ icon: "⚠️", text: "Proprietary technology mentioned — formal IP not confirmed", src: "AI summaries" });
    else evidence.push({ icon: "❌", text: "No IP or proprietary assets referenced in documents", src: "AI summaries" });
  }

  if (hasMoat) evidence.push({ icon: "✅", text: "Competitive moat or defensibility strategy articulated", src: "AI summaries" });
  else evidence.push({ icon: "⚠️", text: "No moat or defensibility strategy detected — investors will probe this", src: "AI summaries" });

  if (formalPts) evidence.push({ icon: "✅", text: "IP ownership documented in legal/incorporation docs", src: "INCORPORATION_DOCS" });
  if (!hasPitch && !hasBizPlan) evidence.push({ icon: "❌", text: "No documents uploaded to assess IP", src: "Document checklist" });

  const flags: FactorFlag[] = [];
  if (isSoftwareIndustry) {
    if (!hasSoftwareIp && !hasFormalIp) flags.push({ severity: "red", label: "No proprietary assets described", detail: "SaaS investors look for proprietary algorithms, data assets, or strong switching costs — not necessarily patents. Describe what makes your software hard to replicate." });
    else if (!hasMoat) flags.push({ severity: "amber", label: "No moat articulated", detail: "For SaaS, moat signals include: network effects, switching costs, data lock-in, integrations, or low churn. Include these in your pitch." });
  } else if (isPatentIndustry) {
    if (!hasFormalIp) flags.push({ severity: "red", label: "No patents or formal IP", detail: "Formal IP protection (patents, trademarks) is critical for hardware/biotech/medtech companies. Investors will not fund without it." });
    else if (!hasMoat) flags.push({ severity: "amber", label: "No moat articulated", detail: "Patents alone are not enough. Describe how IP creates a defensible market position." });
  } else {
    if (!hasFormalIp && !hasSoftwareIp) flags.push({ severity: "red", label: "No IP evidence", detail: "No IP or proprietary assets referenced. Describe what makes the business defensible." });
    if (!hasMoat) flags.push({ severity: "amber", label: "No moat articulated", detail: "Include network effects, switching costs, exclusive partnerships, or data advantages in your pitch." });
  }

  const industryNote = isSoftwareIndustry
    ? " (Software/SaaS industry — proprietary tech and switching costs assessed instead of patents.)"
    : isPatentIndustry
    ? " (Patent-critical industry — formal IP protection is required.)"
    : "";

  const aiSummary = (hasFormalIp || hasSoftwareIp)
    ? `IP/moat context: ${(pitchSummary ?? bizSummary ?? "").slice(0, 250)}…${industryNote}`
    : hasPitch || hasBizPlan
    ? `Documents uploaded but no IP or moat signals found in summaries.${industryNote} Add defensibility context to your pitch.`
    : `No documents uploaded. IP and competitive moat cannot be assessed.${industryNote}`;

  return { pts, max: 8, rating: rating(pts, 8), aiSummary, subScores, evidence, flags };
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

  return { pts, max: 8, rating: rating(pts, 8), aiSummary, subScores, evidence, flags };
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

  return { pts, max: 4, rating: rating(pts, 4), aiSummary, subScores, evidence, flags };
}

function scoreExitStrategy(
  has: (t: string) => boolean,
  getSummary: (t: string) => string | null,
): FactorScore {
  const hasPitch = has("PITCH_DECK");
  const hasBizPlan = has("BUSINESS_PLAN");
  const pitchSummary = getSummary("PITCH_DECK");
  const bizSummary = getSummary("BUSINESS_PLAN");

  const combinedSummary = [pitchSummary, bizSummary].filter(Boolean).join(" ");

  const EXIT_SPECIFIC = ["acquisition", "ipo", "initial public offering", "strategic buyer", "trade sale", "buyout", "liquidity event", "exit multiple", "strategic acquisition"];
  const EXIT_GENERAL = ["exit", "exit strategy", "returns", "investor returns", "path to liquidity", "return on investment", "exit plan"];
  const RETURN_PROJECTIONS = ["multiple", "irr", "internal rate of return", "5x", "10x", "3x", "exit valuation", "projected valuation", "comparable acquisition", "comparable exit"];

  const hasSpecificExit = containsKeywords(combinedSummary, EXIT_SPECIFIC);
  const hasGeneralExit = containsKeywords(combinedSummary, EXIT_GENERAL);
  const hasReturnProjections = containsKeywords(combinedSummary, RETURN_PROJECTIONS);

  // Exit strategy: 0–4
  const exitPts = hasSpecificExit ? 4 : hasGeneralExit ? 2 : 0;
  // Return projections: 0–2
  const returnPts = hasReturnProjections ? 2 : hasSpecificExit ? 1 : 0;
  // Timeline: 0–1
  const timelinePts = containsKeywords(combinedSummary, ["year", "timeline", "horizon", "5 year", "3 year", "7 year"]) && hasGeneralExit ? 1 : 0;

  const subScores: FactorSubScore[] = [
    { label: "Exit type explicitly stated", pts: exitPts, max: 4 },
    { label: "Investor return projections", pts: returnPts, max: 2 },
    { label: "Exit timeline indicated", pts: timelinePts, max: 1 },
  ];

  let pts = clamp(subScores.reduce((s, x) => s + x.pts, 0), 0, 7);
  if (!hasPitch && !hasBizPlan) pts = 0;
  else if (!pitchSummary && !bizSummary) pts = Math.min(pts, 1);

  const evidence: FactorEvidence[] = [];
  if (hasSpecificExit) evidence.push({ icon: "✅", text: `Specific exit path stated (acquisition, IPO, or trade sale)`, src: "AI summaries" });
  else if (hasGeneralExit) evidence.push({ icon: "⚠️", text: "Exit strategy mentioned but no specific exit type stated", src: "AI summaries" });
  else evidence.push({ icon: "❌", text: "No exit strategy found — investors need to know how they get returns", src: "AI summaries" });

  if (hasReturnProjections) evidence.push({ icon: "✅", text: "Investor return projections or exit multiples referenced", src: "AI summaries" });
  else evidence.push({ icon: "⚠️", text: "No return projections stated — include expected exit multiple or IRR", src: "AI summaries" });

  const flags: FactorFlag[] = [];
  if (!hasGeneralExit) flags.push({ severity: "red", label: "No exit strategy", detail: "Every investor needs to know how they get their money back. Add an exit strategy slide to your pitch deck." });
  else if (!hasSpecificExit) flags.push({ severity: "amber", label: "Vague exit strategy", detail: "General exit language found but no specific path (acquisition target, IPO timeline, etc.). Be specific." });
  if (!hasReturnProjections) flags.push({ severity: "amber", label: "No return projections", detail: "Include expected exit multiple (e.g. 5–10x), comparable acquisitions in your sector, or projected IRR." });

  const aiSummary = hasSpecificExit
    ? `Exit strategy found: ${combinedSummary.slice(0, 250)}…`
    : hasGeneralExit
    ? "Exit referenced but not specific. Add a clear exit path and investor return projections to your pitch."
    : hasPitch || hasBizPlan
    ? "Documents uploaded but no exit strategy found. Add an exit slide — investors pass on deals with no clear liquidity path."
    : "No documents uploaded. Exit strategy cannot be assessed.";

  return { pts, max: 7, rating: rating(pts, 7), aiSummary, subScores, evidence, flags };
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
    { label: "Funding amount declared", pts: fundingAmount ? 1 : 0, max: 1 },
    { label: "Deal structure terms in docs", pts: hasDealKeywords ? 1 : 0, max: 1 },
    { label: "Use of funds breakdown", pts: hasUseOfFunds ? 1 : 0, max: 1 },
  ];

  const pts = clamp(subScores.reduce((s, x) => s + x.pts, 0), 0, 3);

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

  return { pts, max: 3, rating: rating(pts, 3), aiSummary, subScores, evidence, flags };
}

function scoreIndustryAlignment(
  industry: string | null,
  revenueStage: string | null,
): FactorScore {
  const FOCUS_INDUSTRIES = ["fintech", "healthtech", "edtech", "cleantech", "proptech", "agritech", "saas", "technology", "finance", "health", "software", "medtech", "insurtech"];
  const industryMatch = industry ? FOCUS_INDUSTRIES.some((f) => industry.toLowerCase().includes(f)) : false;

  const subScores: FactorSubScore[] = [
    { label: "Industry & stage declared", pts: industry && revenueStage ? 1 : industry || revenueStage ? 1 : 0, max: 1 },
  ];

  const pts = clamp(subScores.reduce((s, x) => s + x.pts, 0), 0, 1);

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

  return { pts, max: 1, rating: rating(pts, 1), aiSummary, subScores, evidence, flags };
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
    { label: "ESG/impact keywords in docs", pts: hasEsgKeywords ? 1 : 0, max: 1 },
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

  return { pts, max: 1, rating: rating(pts, 1), aiSummary, subScores, evidence, flags };
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
    customer_traction:  scoreCustomerTraction(has, getSummary, input.revenueStage),
    founder_team:       scoreFounderTeam(has, getSummary, input.companyName, input.industry),
    market_evidence:    scoreMarketEvidence(has, getSummary, input.industry),
    unit_economics:     scoreUnitEconomics(has, getSummary, input.revenueStage),
    governance_legal:   scoreGovernanceLegal(has, getSummary, input.industry),
    ip_moat:            scoreIpMoat(has, getSummary, input.industry),
    burn_runway:        scoreBurnRunway(has, getSummary, input.fundingAmount, input.revenueStage),
    exit_strategy:      scoreExitStrategy(has, getSummary),
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
