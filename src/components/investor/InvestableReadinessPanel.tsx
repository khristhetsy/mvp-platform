"use client";

/**
 * InvestableReadinessPanel
 *
 * Investor-only. Shows overall readiness score + per-factor breakdown.
 * Tabs: Overview · Recommendations · History · Platform Comparison
 * Export: print-friendly PDF via window.print()
 */

import { useState } from "react";
import { READINESS_FACTORS } from "@/lib/ai/readiness-scoring";
import type { FactorKey, FactorScore } from "@/lib/ai/readiness-scoring";

type Props = {
  companyName: string;
  totalScore: number;
  factorScores: Record<FactorKey, FactorScore>;
  effectiveScore?: number | null;
  isOverridden?: boolean;
  scoredAt?: string | null;
  scoreHistory?: Array<{ score: number; scoredAt: string }>;
  platformAvg?: number | null;
  percentile?: number | null;
};

const FACTOR_COLORS: Record<string, string> = {
  revenue_cashflow:   "#378ADD",
  customer_traction:  "#10B981",
  founder_team:       "#1D9E75",
  market_evidence:    "#378ADD",
  unit_economics:     "#F59E0B",
  governance_legal:   "#E8922A",
  ip_moat:            "#8B5CF6",
  burn_runway:        "#EF4444",
  exit_strategy:      "#6366F1",
  pitch_quality:      "#94A3B8",
  deal_structure:     "#A78BFA",
  industry_alignment: "#1D9E75",
  impact_esg:         "#1D9E75",
};

const FACTOR_TAGS: Record<string, { bg: string; text: string }> = {
  Financial:    { bg: "#E6F1FB", text: "#185FA5" },
  Traction:     { bg: "#ECFDF5", text: "#065F46" },
  Team:         { bg: "#EAF3DE", text: "#3B6D11" },
  Market:       { bg: "#E6F1FB", text: "#185FA5" },
  Economics:    { bg: "#FFFBEB", text: "#92400E" },
  Legal:        { bg: "#FAEEDA", text: "#854F0B" },
  Moat:         { bg: "#F5F3FF", text: "#5B21B6" },
  Strategy:     { bg: "#EEF2FF", text: "#3730A3" },
  Documents:    { bg: "#EEF0FF", text: "#4338CA" },
  "Deal Terms": { bg: "#F3F0FE", text: "#5B2EAA" },
  Fit:          { bg: "#EAF3DE", text: "#3B6D11" },
  ESG:          { bg: "#EAF3DE", text: "#3B6D11" },
};

type Tab = "overview" | "recommendations" | "history" | "comparison";

function scoreColor(pct: number): string {
  if (pct >= 0.75) return "#1D9E75";
  if (pct >= 0.45) return "#E8922A";
  return "#D9534F";
}

function ScoreBadge({ rating }: { rating: string }) {
  const cls: Record<string, string> = {
    Strong:        "bg-emerald-50 text-emerald-700",
    Developing:    "bg-amber-50 text-amber-700",
    "Needs Work":  "bg-red-50 text-red-700",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls[rating] ?? "bg-slate-100 text-slate-600"}`}>
      {rating}
    </span>
  );
}

function FlagChip({ severity, label }: { severity: string; label: string }) {
  const cls: Record<string, string> = {
    red:   "bg-red-50 text-red-700",
    amber: "bg-amber-50 text-amber-700",
    green: "bg-emerald-50 text-emerald-700",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls[severity] ?? "bg-slate-100 text-slate-600"}`}>
      {label}
    </span>
  );
}

function FactorModal({
  factorKey,
  score,
  onClose,
}: {
  factorKey: FactorKey;
  score: FactorScore;
  onClose: () => void;
}) {
  const def = READINESS_FACTORS.find((f) => f.key === factorKey)!;
  const color = FACTOR_COLORS[factorKey] ?? "#378ADD";
  const tag = FACTOR_TAGS[def.tag] ?? { bg: "#F1F5F9", text: "#475569" };
  const pct = score.pts / score.max;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-slate-100 bg-white px-6 py-5">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            ✕
          </button>
          <span
            className="rounded-full px-2 py-0.5 text-xs font-semibold"
            style={{ background: tag.bg, color: tag.text }}
          >
            {def.tag}
          </span>
          <h2 className="mt-2 text-base font-semibold text-slate-950">{def.label}</h2>
          <p className="mt-0.5 text-xs text-slate-400">
            {score.pts} / {score.max} pts · {score.rating}
          </p>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Score bar */}
          <div>
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-4xl font-semibold" style={{ color }}>{score.pts}</span>
              <span className="text-lg text-slate-400">/ {score.max}</span>
              <ScoreBadge rating={score.rating} />
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${pct * 100}%`, background: color }}
              />
            </div>
          </div>

          {/* AI Analysis */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">AI Analysis</p>
            <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-600">
              {score.aiSummary || "No analysis available."}
            </div>
          </div>

          {/* Sub-scores */}
          {score.subScores.length > 0 && (
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Sub-scores</p>
              <div className="space-y-2">
                {score.subScores.map((s) => (
                  <div key={s.label} className="flex items-center gap-3">
                    <span className="w-36 shrink-0 text-xs text-slate-500">{s.label}</span>
                    <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${(s.pts / s.max) * 100}%`, background: color }}
                      />
                    </div>
                    <span className="w-10 text-right text-xs font-medium text-slate-700">
                      {s.pts}/{s.max}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Evidence */}
          {score.evidence.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Evidence from documents
              </p>
              <div className="divide-y divide-slate-100 rounded-xl border border-slate-100">
                {score.evidence.map((e, i) => (
                  <div key={i} className="flex gap-3 px-4 py-3">
                    <span className="mt-0.5 shrink-0">{e.icon}</span>
                    <div>
                      <p className="text-sm text-slate-700">{e.text}</p>
                      <p className="mt-0.5 text-xs text-slate-400">{e.src}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Flags */}
          {score.flags.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Flags & recommendations
              </p>
              <div className="space-y-2">
                {score.flags.map((f, i) => (
                  <div key={i} className="flex items-start gap-3 rounded-xl bg-slate-50 px-4 py-3">
                    <FlagChip severity={f.severity} label={f.label} />
                    <p className="text-xs leading-relaxed text-slate-500">{f.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 border-t border-slate-100 bg-white px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Analyst recommendations engine ──────────────────────────────────────────

type Recommendation = {
  priority: "high" | "medium" | "low";
  factor: string;
  action: string;
  detail: string;
  analystNote: string;
  steps: string[];
  resources: { label: string; url?: string }[];
  courses: { slug: string; title: string }[];
};

// eLearning course catalog (slugs → titles, URLs = /founder/learning/[slug])
const COURSES: Record<string, string> = {
  "investor-readiness-masterclass":  "Investor Readiness Masterclass",
  "investor-ready-pitch-deck":       "Building an Investor-Ready Pitch Deck",
  "startup-financial-forecasting":   "Startup Financial Forecasting",
  "data-room-preparation":           "Data Room Preparation",
  "founder-governance-basics":       "Founder Governance Basics",
  "fundraising-communication":       "Fundraising Communication",
  "how-investors-evaluate-startups": "How Investors Evaluate Startups",
  "capital-strategy-foundations":    "Capital Strategy Foundations",
};

function resolveCourses(slugs: string[]) {
  return slugs.map((slug) => ({ slug, title: COURSES[slug] ?? slug }));
}

// Deep playbook — maps flag label → analyst-grade guidance
const ANALYST_PLAYBOOK: Record<string, {
  analystNote: string;
  steps: string[];
  resources: { label: string; url?: string }[];
  courses?: string[];
}> = {
  "Missing financials": {
    analystNote: "Financial statements are the single most important document in any investor due diligence process. Without them, cash position, burn rate, and revenue trajectory are completely unknown — most investors will not proceed past initial screening.",
    steps: [
      "Prepare a 12-month Profit & Loss statement (actuals, not projections)",
      "Add a Cash Flow Statement showing monthly opening/closing cash balance",
      "Include a Balance Sheet showing assets, liabilities, and equity",
      "Attach 24-month financial projections with clearly stated assumptions",
      "If pre-revenue, at minimum show a detailed cost model and burn rate calculation",
    ],
    resources: [
      { label: "Xero (accounting software)", url: "https://www.xero.com" },
      { label: "QuickBooks Online", url: "https://quickbooks.intuit.com" },
      { label: "Wave (free for small business)", url: "https://www.waveapps.com" },
    ],
    courses: ["startup-financial-forecasting", "data-room-preparation"],
  },
  "Pre-revenue": {
    analystNote: "Pre-revenue status is a significant risk multiplier. Investors will apply a heavy discount to the valuation and require stronger evidence of demand (LOIs, pilots, waitlists) to compensate. Every dollar of revenue — even $1,000/month — dramatically changes investor perception.",
    steps: [
      "Pursue at least 3 signed Letters of Intent (LOIs) from target customers before your next pitch",
      "Launch a paid pilot program — even at a steep discount — to establish revenue",
      "Document your sales pipeline with named prospects and estimated close dates",
      "Build a revenue bridge showing the path from $0 to first $10k MRR",
      "Prepare a pre-money valuation justification based on comparables, not future projections",
    ],
    resources: [
      { label: "LOI template (Y Combinator)", url: "https://www.ycombinator.com/documents" },
      { label: "First Round Capital's fundraising guide", url: "https://firstround.com/review/fundraising" },
    ],
    courses: ["investor-readiness-masterclass", "startup-financial-forecasting"],
  },
  "No customer evidence": {
    analystNote: "Customer evidence is the most powerful de-risking signal available to early-stage investors. Even informal customer discovery interviews documented as quotes are better than nothing. Investors are evaluating whether real humans will pay for this solution.",
    steps: [
      "Document at least 10 customer discovery interviews with direct quotes",
      "Pursue signed LOIs or pilot agreements from 3–5 target customers",
      "Build a one-page customer evidence summary: who they are, their pain, and what they said",
      "Add a customer logos slide to your pitch deck (even for pilot/beta customers)",
      "Create a reference-able customer list investors can call during due diligence",
    ],
    resources: [
      { label: "Mom Test (customer interview framework)", url: "https://www.momtestbook.com" },
      { label: "DocuSign (for LOI/pilot agreements)", url: "https://www.docusign.com" },
    ],
    courses: ["investor-readiness-masterclass", "how-investors-evaluate-startups"],
  },
  "No paying customers or LOIs": {
    analystNote: "The gap between 'interested users' and 'paying customers' is where most startups stall. Investors have seen thousands of companies with enthusiastic waitlists that never converted. A single signed LOI carries more weight than 500 email sign-ups.",
    steps: [
      "Convert your 3 most engaged users/beta testers into paid pilots immediately",
      "Offer a founder discount (50–70% off) in exchange for a signed LOI and reference",
      "Draft a simple 1-page LOI template: customer name, intended use, indicative volume, expected start date",
      "Add MRR/ARR figures to your pitch — even $500/month shows revenue intent",
      "Document churn rate if you have any paying customers — retention is as important as acquisition",
    ],
    resources: [
      { label: "LOI template", url: "https://www.ycombinator.com/documents" },
      { label: "Stripe (payments/MRR tracking)", url: "https://stripe.com" },
      { label: "Baremetrics (MRR analytics)", url: "https://baremetrics.com" },
    ],
    courses: ["investor-readiness-masterclass"],
  },
  "No traction metrics": {
    analystNote: "Narrative language ('strong growth', 'rapidly expanding customer base') is meaningless without numbers. Investors hear hundreds of pitches with the same language. A single concrete number — '87 paying customers, 23% month-over-month growth' — cuts through instantly.",
    steps: [
      "Replace all narrative language in your pitch with specific numbers",
      "Track and report: MRR, MoM growth %, customer count, churn rate, NPS",
      "Add a traction slide to your pitch deck with a growth chart (even if small)",
      "Document your sales pipeline: number of active deals, average deal size, close rate",
      "Calculate your CAC and LTV — even rough estimates demonstrate business model awareness",
    ],
    resources: [
      { label: "Chartmogul (subscription analytics)", url: "https://chartmogul.com" },
      { label: "ProfitWell (MRR tracking, free)", url: "https://www.profitwell.com" },
    ],
    courses: ["investor-readiness-masterclass", "how-investors-evaluate-startups"],
  },
  "Pre-revenue without LOIs": {
    analystNote: "For pre-revenue companies, LOIs are the minimum evidence standard. They demonstrate that real buyers, with real budgets, have committed in writing to purchasing your solution. Without them, the investment thesis rests entirely on the founders' assertions.",
    steps: [
      "Identify your top 10 most likely first customers and approach them this week",
      "Offer free or heavily discounted access in exchange for a signed LOI",
      "Include the LOI terms: company name, product/service, expected purchase timeline, indicative value",
      "Aim for a minimum of 3 LOIs before your next investor meeting",
      "If LOIs aren't possible, collect paid deposits or pre-orders as an alternative",
    ],
    resources: [
      { label: "Simple LOI template (Google Docs)", url: "https://docs.google.com" },
      { label: "Stripe for pre-orders / deposits", url: "https://stripe.com" },
    ],
    courses: ["investor-readiness-masterclass"],
  },
  "No team evidence": {
    analystNote: "At the early stage, investors are fundamentally betting on the team. A pitch deck without a team slide is incomplete by definition. Investors need to understand who the founders are, what they've done, and why they are uniquely positioned to solve this problem.",
    steps: [
      "Add a dedicated team slide to your pitch deck: photos, names, roles, and 2–3 most relevant credentials",
      "Include previous companies founded or worked at (even in adjacent roles)",
      "Highlight domain expertise — years in the industry, key relationships, or unfair advantages",
      "Add a 'Why us' section explaining why this team will win this market",
      "Upload a business plan with a founder background section",
    ],
    resources: [
      { label: "Sequoia pitch deck template", url: "https://www.sequoiacap.com/article/how-to-present-to-investors" },
      { label: "DocSend pitch deck best practices", url: "https://docsend.com/pitch-deck-best-practices" },
    ],
    courses: ["investor-readiness-masterclass", "how-investors-evaluate-startups"],
  },
  "Solo founder risk": {
    analystNote: "Solo founder risk is one of the most frequently cited reasons early-stage deals don't close. Investors worry about key-person dependency, execution capacity, and the signal that no one else was willing to quit their job to join. A strong advisory board partially mitigates this, but a co-founder is the ideal solution.",
    steps: [
      "Actively recruit a technical or operational co-founder with complementary skills",
      "Build an advisory board of 3–5 experienced operators with small equity stakes (0.1–0.5%)",
      "At minimum, identify a part-time CFO advisor and CTO advisor",
      "Document your hiring plan — who are the first 5 people you'll hire with the raise?",
      "Show investors you've thought about succession — who runs the company if you're incapacitated?",
    ],
    resources: [
      { label: "CoFoundersLab", url: "https://cofounderslab.com" },
      { label: "YC co-founder matching", url: "https://www.ycombinator.com/cofounder-matching" },
      { label: "Advisors equity calculator (Carta)", url: "https://carta.com" },
    ],
    courses: ["investor-readiness-masterclass", "how-investors-evaluate-startups"],
  },
  "No prior experience evidence": {
    analystNote: "Prior startup, domain, or exit experience is a strong credibility signal. Investors pattern-match: founders who have navigated a company from early stage to exit (even a small one) carry significantly lower execution risk in investors' mental models.",
    steps: [
      "Add a 'Founder credentials' section to your pitch with specific past achievements",
      "Quantify your domain experience: '12 years in fintech, previously led product at X'",
      "If you have prior exits, name them and approximate the outcome",
      "Reference relevant industry relationships, regulatory knowledge, or technical patents",
      "If you lack experience, compensate with advisors who have the track record you're missing",
    ],
    resources: [
      { label: "LinkedIn (credential documentation)", url: "https://linkedin.com" },
    ],
    courses: ["investor-readiness-masterclass", "how-investors-evaluate-startups"],
  },
  "No incorporation docs": {
    analystNote: "Without verified legal entity status, an investor cannot legally execute a term sheet, transfer funds, or take an equity position. This is a hard blocker — no investor can proceed without it, regardless of how compelling the opportunity appears.",
    steps: [
      "Incorporate immediately if you haven't already — this can be done online in 24–48 hours",
      "Choose an appropriate structure: Pty Ltd (AU), Ltd (UK), C-Corp or Delaware LLC (US)",
      "Ensure IP assignment agreements are signed by all founders at incorporation",
      "Upload your certificate of incorporation, constitution/articles, and any shareholder agreements",
      "If operating across multiple jurisdictions, clarify your primary entity for investment purposes",
    ],
    resources: [
      { label: "Stripe Atlas (US C-Corp, fast)", url: "https://stripe.com/atlas" },
      { label: "Clerky (startup legal docs)", url: "https://clerky.com" },
      { label: "Australian Business Register (ABN)", url: "https://www.abr.gov.au" },
    ],
    courses: ["founder-governance-basics", "data-room-preparation"],
  },
  "No cap table": {
    analystNote: "The cap table tells an investor exactly what they're buying and what the ownership structure looks like post-investment. Missing or incorrect cap tables are one of the top causes of deal delays and failures. Investors need to model their ownership %, anti-dilution rights, and exit scenarios.",
    steps: [
      "Create a cap table listing all shareholders, share classes, and ownership percentages",
      "Include all issued shares, options (vested and unvested), warrants, and convertible notes",
      "Document any SAFE or convertible note holders with conversion terms",
      "Show a post-money cap table modelling the current raise and investor's expected ownership",
      "Use dedicated cap table software rather than a spreadsheet to avoid errors",
    ],
    resources: [
      { label: "Carta (cap table management)", url: "https://carta.com" },
      { label: "Pulley (startup equity)", url: "https://pulley.com" },
      { label: "Captable.io (free for startups)", url: "https://captable.io" },
    ],
    courses: ["founder-governance-basics", "data-room-preparation"],
  },
  "No market documents": {
    analystNote: "Investors need evidence that you understand your market deeply — not just that a market exists. The market slide is often the first filter: if your TAM/SAM/SOM analysis is credible, it signals rigorous thinking. If it's a generic '$5 trillion global market' claim, it signals the opposite.",
    steps: [
      "Add a market slide to your pitch: TAM (total addressable), SAM (serviceable), SOM (obtainable)",
      "Source your market size from credible third parties (Gartner, IDC, government data)",
      "Define your beachhead market — the specific segment you'll win first",
      "Include a bottoms-up market calculation alongside the top-down estimate",
      "Map out the customer journey and buying process for your target segment",
    ],
    resources: [
      { label: "Statista (market research)", url: "https://www.statista.com" },
      { label: "IBISWorld (industry reports)", url: "https://www.ibisworld.com" },
      { label: "Google Trends (demand signals)", url: "https://trends.google.com" },
    ],
    courses: ["investor-readiness-masterclass", "how-investors-evaluate-startups"],
  },
  "No traction evidence": {
    analystNote: "Investors cannot underwrite a market size claim without evidence that real customers will pay for your solution. Traction — even early, small-scale traction — transforms a thesis into a de-risked opportunity. The quality of your traction evidence directly determines the valuation discussion.",
    steps: [
      "Add specific traction metrics to every document: customer count, MRR, growth rate, retention",
      "If pre-revenue, use pipeline data: number of active deals, total pipeline value, expected close rate",
      "Include a traction slide showing month-by-month growth in a key metric",
      "Attach customer testimonials or quotes as an appendix",
      "Document your go-to-market motion: how you acquired each customer",
    ],
    resources: [
      { label: "Chartmogul (MRR/ARR tracking)", url: "https://chartmogul.com" },
      { label: "Mixpanel (product analytics)", url: "https://mixpanel.com" },
    ],
    courses: ["investor-readiness-masterclass", "how-investors-evaluate-startups"],
  },
  "No competitive analysis": {
    analystNote: "Investors conduct their own competitive research before every meeting. Arriving without a competitive landscape analysis signals either a lack of market knowledge or intellectual dishonesty. Acknowledging competitors and articulating specific differentiation demonstrates market maturity.",
    steps: [
      "Map at least 5 direct and 5 indirect competitors on a 2x2 matrix",
      "Identify the 3 dimensions where you are definitively better — with evidence",
      "Include competitor pricing, market share estimates, and customer reviews",
      "Explain why incumbents haven't already solved this problem",
      "Prepare for the question: 'What happens when [large competitor] copies you?'",
    ],
    resources: [
      { label: "G2 / Capterra (software comparisons)", url: "https://www.g2.com" },
      { label: "SimilarWeb (competitor traffic)", url: "https://www.similarweb.com" },
      { label: "Crunchbase (competitor funding)", url: "https://www.crunchbase.com" },
    ],
    courses: ["how-investors-evaluate-startups", "investor-readiness-masterclass"],
  },
  "No unit economics": {
    analystNote: "Unit economics are the proof that your business model works at scale. LTV:CAC above 3:1 with a payback period under 18 months is the benchmark most Series A investors apply. Without this data, investors cannot model their return and will either pass or significantly discount the valuation.",
    steps: [
      "Calculate LTV: Average Contract Value × Gross Margin % × Average Customer Lifetime",
      "Calculate CAC: Total Sales & Marketing Spend ÷ New Customers Acquired (same period)",
      "Calculate Payback Period: CAC ÷ (Monthly Revenue per Customer × Gross Margin %)",
      "Present LTV:CAC ratio — aim to show a path to 3:1 or better within 12–18 months",
      "Add a unit economics slide to your pitch deck with a simple table showing these four metrics",
    ],
    resources: [
      { label: "David Skok's SaaS metrics guide", url: "https://www.forentrepreneurs.com/saas-metrics-2" },
      { label: "a16z unit economics framework", url: "https://a16z.com/2015/08/21/16-metrics" },
      { label: "Baremetrics (MRR/LTV tracking)", url: "https://baremetrics.com" },
    ],
    courses: ["startup-financial-forecasting", "how-investors-evaluate-startups"],
  },
  "No LTV/CAC stated": {
    analystNote: "Gross margin data without LTV:CAC is incomplete. The ratio between customer lifetime value and acquisition cost is the single most-asked unit economics question in investor meetings. Investors who can't see this ratio will estimate it themselves — usually pessimistically.",
    steps: [
      "State your LTV:CAC ratio explicitly in your pitch deck and business plan",
      "Show the calculation methodology so investors can stress-test your assumptions",
      "If LTV:CAC is below 3:1, include a roadmap to improving it (pricing changes, upsell, reduced churn)",
      "Segment LTV:CAC by customer type if you serve multiple segments",
      "Track and report payback period alongside LTV:CAC",
    ],
    resources: [
      { label: "SaaS metrics benchmark report (KeyBanc)", url: "https://www.key.com/businesses-institutions/industry-expertise/technology/saas-survey.jsp" },
      { label: "OpenView SaaS benchmarks", url: "https://openviewpartners.com/saas-benchmarks-report" },
    ],
    courses: ["startup-financial-forecasting"],
  },
  "No scalability narrative": {
    analystNote: "Investors are buying future value, not current revenue. The scalability narrative explains how margins improve, costs decrease, or revenue accelerates as the company grows. Without it, investors cannot model the returns that justify their risk.",
    steps: [
      "Describe your fixed vs. variable cost structure and how it evolves at 10x revenue",
      "Project gross margin improvement over 3 years as scale reduces COGS",
      "Explain network effects or platform leverage if applicable",
      "Include a simple unit economics improvement table: Year 1, Year 2, Year 3 projections",
      "Reference comparable companies' margin profiles at your target scale",
    ],
    resources: [
      { label: "a16z scaling frameworks", url: "https://a16z.com/scaling" },
    ],
    courses: ["startup-financial-forecasting", "capital-strategy-foundations"],
  },
  "No IP evidence": {
    analystNote: "Defensibility is a core investor concern. Without any IP or proprietary asset claims, investors will question whether the business can be replicated by a well-funded competitor. Even informal trade secrets or proprietary data assets should be documented.",
    steps: [
      "Document all proprietary technology, algorithms, data assets, or processes in your pitch",
      "File a provisional patent application if you have a patentable invention ($1,500–$3,000 in most jurisdictions)",
      "Trademark your business name and key product names",
      "Ensure all founder and employee IP assignment agreements are signed",
      "If IP is software-based, describe what makes it proprietary and difficult to replicate",
    ],
    resources: [
      { label: "USPTO (US patents)", url: "https://www.uspto.gov" },
      { label: "IP Australia", url: "https://www.ipaustralia.gov.au" },
      { label: "LegalZoom (trademarks)", url: "https://www.legalzoom.com" },
    ],
    courses: ["data-room-preparation", "how-investors-evaluate-startups"],
  },
  "No proprietary assets described": {
    analystNote: "For SaaS companies, the moat is rarely a patent — it's proprietary data, algorithms, network effects, or deep integrations that create switching costs. Investors expect you to articulate specifically what you've built that competitors can't quickly replicate.",
    steps: [
      "Identify your top 3 defensibility claims: what takes competitors 12+ months to replicate?",
      "Document your proprietary data assets: how much data do you have, from what sources, and how is it used?",
      "Quantify switching costs: what does it cost a customer (time, money, disruption) to leave?",
      "Describe network effects if present: how does each new user make the product better for all users?",
      "Add a moat slide or section to your pitch explaining your competitive defensibility",
    ],
    resources: [
      { label: "Hamilton Helmer's '7 Powers' (moat framework)", url: "https://www.amazon.com/7-Powers-Foundations-Business-Strategy/dp/0998116343" },
      { label: "Bessemer's cloud computing benchmarks", url: "https://www.bvp.com/atlas/road-to-repvenue" },
    ],
    courses: ["how-investors-evaluate-startups", "capital-strategy-foundations"],
  },
  "No patents or formal IP": {
    analystNote: "For hardware, biotech, medtech, and cleantech companies, patents are not optional — they are a prerequisite for serious investor conversations. Without patent protection, any well-funded competitor can replicate your product the moment it gains traction.",
    steps: [
      "File provisional patent applications on all novel inventions immediately",
      "Engage a patent attorney to conduct a prior art search and freedom-to-operate analysis",
      "Trademark your brand name and key product names in all target markets",
      "Document any trade secrets in a confidential internal register",
      "Include an IP landscape slide showing your patents (pending or granted) vs. competitors'",
    ],
    resources: [
      { label: "USPTO Patent Center", url: "https://www.uspto.gov/patents" },
      { label: "European Patent Office", url: "https://www.epo.org" },
      { label: "Patent filing via LexisNexis TotalPatent One", url: "https://www.lexisnexis.com" },
    ],
    courses: ["data-room-preparation"],
  },
  "Weak IP": {
    analystNote: "Proprietary language without formal IP protection is a medium-term vulnerability. Investors may accept it at seed stage but will expect formal protection in place before Series A. Begin the process now — patents take 2–4 years to grant, and the provisional filing date is what matters.",
    steps: [
      "File provisional patent applications on your core innovations within 90 days",
      "Conduct a freedom-to-operate (FTO) search to confirm you're not infringing existing patents",
      "Trademark your company name and product name in your primary market",
      "Ensure all contractors and employees have signed IP assignment agreements",
      "Add IP status to your pitch: 'Patent pending as of [date]' is a positive signal",
    ],
    resources: [
      { label: "USPTO provisional application", url: "https://www.uspto.gov/patents/basics/types-patent-applications/provisional-application-patent" },
      { label: "Clerky (startup IP agreements)", url: "https://clerky.com" },
    ],
    courses: ["data-room-preparation", "founder-governance-basics"],
  },
  "No moat articulated": {
    analystNote: "Investors will always ask 'what stops a well-funded competitor from copying you in 6 months?' If you don't have a prepared answer, the meeting ends there. The moat doesn't need to be impenetrable — it needs to be real, documented, and sufficient to maintain a 12–18 month lead.",
    steps: [
      "Add a defensibility slide to your pitch explicitly answering 'why can't someone copy this?'",
      "Identify which of the 7 moat types applies: network effects, switching costs, cost advantage, intangible assets, efficient scale, counter-positioning, or process power",
      "Quantify your lead time advantage: how long would it take a competitor to reach your current position?",
      "Document customer retention metrics as evidence of switching costs",
      "List specific barriers to entry in your market (regulatory, technical, relationship-based)",
    ],
    resources: [
      { label: "7 Powers framework summary", url: "https://medium.com/@chrisstonehouse/7-powers-the-foundations-of-business-strategy-50bfce5f4a85" },
      { label: "Andreessen Horowitz competitive moat guide", url: "https://a16z.com/2011/08/20/why-software-is-eating-the-world" },
    ],
    courses: ["how-investors-evaluate-startups", "capital-strategy-foundations"],
  },
  "No financial statements": {
    analystNote: "Burn rate and runway are the first questions every investor asks after seeing the ask amount. 'How much runway does this give you?' and 'What's your current monthly burn?' are standard opening questions in any due diligence process. Without financials, these questions cannot be answered.",
    steps: [
      "Prepare a monthly P&L showing operating expenses broken down by category",
      "Calculate current monthly burn rate: total cash out minus total cash in",
      "State current cash position and calculate runway: Cash Balance ÷ Monthly Burn",
      "Show how the raise extends runway: new cash ÷ projected monthly burn post-raise",
      "Include a sensitivity analysis: what happens to runway if revenue is 50% of projection?",
    ],
    resources: [
      { label: "Xero (cloud accounting)", url: "https://www.xero.com" },
      { label: "KPMG startup financial model templates", url: "https://home.kpmg/au/en/home/insights.html" },
    ],
    courses: ["startup-financial-forecasting", "data-room-preparation"],
  },
  "No burn/runway data": {
    analystNote: "Financial statements are uploaded but investors can't find explicit burn and runway figures. Investors look for a simple statement: 'Current burn: $X/month. Current cash: $Y. Runway: Z months. Post-raise runway: A months.' If it's not stated clearly, investors assume the numbers are bad.",
    steps: [
      "Add a clearly labelled 'Cash position & runway' section to your financial documents",
      "State monthly burn in a single line — don't bury it in a P&L",
      "Include a cash runway chart: month-by-month cash balance projection",
      "Show burn by category: salaries, infrastructure, sales & marketing, other",
      "Provide a milestone-based burn plan: what milestones does the raise fund, and at what cost?",
    ],
    resources: [
      { label: "Baremetrics cash flow forecasting", url: "https://baremetrics.com" },
      { label: "Float (cash flow forecasting)", url: "https://floatapp.com" },
    ],
    courses: ["startup-financial-forecasting"],
  },
  "No exit strategy": {
    analystNote: "Investors are buying future liquidity, not just equity. Every investor — from angels to VCs — needs to understand how and when they get their money back. A company without a clear exit path is essentially asking investors to park capital indefinitely, which is not an investable proposition.",
    steps: [
      "Add an exit slide to your pitch deck: name 3–5 specific potential acquirers in your sector",
      "Research recent comparable acquisitions: company name, acquirer, revenue at exit, and multiple paid",
      "State your target exit timeline: 'We plan to reach exit-ready scale within 5 years'",
      "Project the exit valuation using revenue multiples from comparable transactions",
      "Consider alternative paths: strategic acquisition, PE buyout, or IPO — and which is most realistic",
    ],
    resources: [
      { label: "Crunchbase M&A data", url: "https://www.crunchbase.com/discover/acquisitions" },
      { label: "PitchBook comparable transactions", url: "https://pitchbook.com" },
      { label: "CB Insights M&A reports", url: "https://www.cbinsights.com" },
    ],
    courses: ["capital-strategy-foundations", "how-investors-evaluate-startups"],
  },
  "Vague exit strategy": {
    analystNote: "Vague exit language ('we'll be acquired or IPO eventually') signals that the founders haven't done the homework on exit pathways. Investors need to see that you understand who the likely acquirers are, what they pay for companies like yours, and how that creates their return.",
    steps: [
      "Name 5 specific potential acquirers and explain why each would want to buy you",
      "Research acquisition multiples in your sector: revenue multiple, EBITDA multiple, or ARR multiple",
      "Model the investor return: at a 6x revenue exit, what does that mean for a $500k investment at your current valuation?",
      "Add comparable exit transactions with deal values to your pitch appendix",
      "State whether strategic acquisition or financial buyer (PE) is more likely and why",
    ],
    resources: [
      { label: "Crunchbase acquisition data", url: "https://www.crunchbase.com/discover/acquisitions" },
      { label: "PitchBook (sector M&A multiples)", url: "https://pitchbook.com" },
    ],
    courses: ["capital-strategy-foundations", "how-investors-evaluate-startups"],
  },
  "No return projections": {
    analystNote: "Investors think in multiples and IRR, not in revenue figures. A $2M ARR business at a 5x multiple returns $10M — but whether that's attractive depends entirely on the investment terms, dilution path, and time to exit. Founders who can speak fluently about investor returns are taken far more seriously.",
    steps: [
      "Model your exit valuation at Year 3, Year 5, and Year 7 using sector revenue multiples",
      "Calculate the implied return multiple for an investor at your current valuation",
      "Show sensitivity: at 3x, 5x, and 8x ARR multiple, what does the investor make?",
      "Reference 2–3 comparable exits in your sector with deal values",
      "Consider showing an IRR calculation for the base case scenario",
    ],
    resources: [
      { label: "SaaS Capital revenue multiples report", url: "https://www.saas-capital.com/research/private-company-saas-valuations" },
      { label: "Bessemer Venture cloud index", url: "https://www.bvp.com/atlas" },
    ],
    courses: ["capital-strategy-foundations", "startup-financial-forecasting"],
  },
  "No pitch deck": {
    analystNote: "A pitch deck is not optional — it is the primary communication vehicle for raising capital. Investors receive hundreds of opportunities per month; without a deck, yours will not receive serious consideration. A mediocre deck is infinitely better than no deck.",
    steps: [
      "Build a 10–15 slide pitch deck covering: problem, solution, market size, traction, team, business model, financials, ask",
      "Lead with the problem slide — make the investor feel the pain before showing the solution",
      "Use the 'Rule of 5': no slide should require more than 5 seconds to understand its key point",
      "Include a financials slide with at least revenue trajectory and 24-month projections",
      "Test your deck with 3 non-technical people — if they can't explain your business back to you, simplify",
    ],
    resources: [
      { label: "Sequoia pitch deck structure", url: "https://www.sequoiacap.com/article/how-to-present-to-investors" },
      { label: "Airbnb original pitch deck (reference)", url: "https://www.slideshare.net/ryangum/airbnb-pitch-deck-from-2008" },
      { label: "DocSend pitch deck analytics", url: "https://docsend.com" },
    ],
    courses: ["investor-ready-pitch-deck", "investor-readiness-masterclass"],
  },
  "No business plan": {
    analystNote: "While pitch decks are the initial filter, a business plan provides the depth investors need during due diligence. It demonstrates strategic thinking, financial rigour, and operational planning. Investors who are serious about a company will always ask for supporting documentation beyond the deck.",
    steps: [
      "Write a 15–25 page business plan covering: executive summary, market analysis, product/service, go-to-market, operations, financials, team, and risk factors",
      "Include a 3-year financial model with monthly detail for Year 1",
      "Document your go-to-market strategy with specific channels, CAC assumptions, and conversion rates",
      "Add a risk register: what are the top 5 risks and how do you mitigate each?",
      "Include an appendix with supporting market research, customer references, and technical documentation",
    ],
    resources: [
      { label: "Bplans business plan templates", url: "https://www.bplans.com" },
      { label: "SCORE business plan guide", url: "https://www.score.org/resource/business-plan-template-startup-business" },
    ],
    courses: ["investor-ready-pitch-deck", "investor-readiness-masterclass"],
  },

  // ── Life science (biotech / medtech) traction flags ───────────────────────
  "No clinical or R&D traction evidence": {
    analystNote: "For biotech and medtech companies, clinical and R&D milestones replace commercial traction as the primary investor signal. No trial stage, partnership, or grant evidence means investors have no way to assess where the company is in its development journey — the most fundamental due diligence question in life sciences.",
    steps: [
      "Document your current R&D stage explicitly: preclinical, IND-enabling studies, Phase I, II, or III",
      "List any research partnerships, sponsored research agreements, or co-development deals",
      "Summarise non-dilutive funding: NIH, SBIR, STTR, or government grants received",
      "Include a development timeline with completed milestones and upcoming catalysts",
      "Add a scientific advisory board section with KOL names and institutional affiliations",
    ],
    resources: [
      { label: "NIH grant search (ClinicalTrials.gov)", url: "https://clinicaltrials.gov" },
      { label: "SBIR/STTR program", url: "https://www.sbir.gov" },
      { label: "FDA breakthrough device program", url: "https://www.fda.gov/medical-devices/how-study-and-market-your-device/breakthrough-devices-program" },
    ],
    courses: ["how-investors-evaluate-startups", "investor-readiness-masterclass"],
  },

  "No clinical trial stage documented": {
    analystNote: "In life sciences investing, the clinical stage is the single most important piece of information. It determines valuation, risk profile, timeline to exit, and which investor class is appropriate. Preclinical, Phase I, II, and III represent entirely different risk/return propositions — without this information, investors cannot evaluate the opportunity.",
    steps: [
      "State your exact development stage in the first paragraph of your pitch deck and business plan",
      "Describe completed preclinical studies: animal models, POC data, safety profile",
      "If in clinical trials, report: number of sites, patients enrolled, primary endpoint, expected readout date",
      "Include a clear development roadmap: current stage → Phase II → Phase III → regulatory submission → commercialisation",
      "Reference comparable companies that have completed the same stage to anchor your timeline",
    ],
    resources: [
      { label: "ClinicalTrials.gov (trial registration)", url: "https://clinicaltrials.gov" },
      { label: "FDA IND process overview", url: "https://www.fda.gov/drugs/investigational-new-drug-ind-application" },
      { label: "EMA clinical trial guidance", url: "https://www.ema.europa.eu/en/human-regulatory/research-development/clinical-trials" },
    ],
    courses: ["how-investors-evaluate-startups", "investor-readiness-masterclass"],
  },

  "No regulatory milestones documented": {
    analystNote: "Regulatory designations (Breakthrough Device, Orphan Drug, Fast Track, 510k clearance) are powerful investor signals because they represent FDA/EMA validation of the unmet need and can significantly accelerate the path to market. Even planned regulatory interactions should be documented — it shows strategic awareness of the regulatory pathway.",
    steps: [
      "Document any regulatory designations already received (Breakthrough Device, Orphan Drug, Fast Track, PRIME)",
      "Describe your planned regulatory pathway: 510(k), PMA, NDA, BLA — and why you've chosen it",
      "Include your pre-IND or pre-submission meeting outcomes if completed",
      "List key regulatory milestones on your development timeline with target dates",
      "Engage a regulatory consultant to formalise your regulatory strategy if you haven't already",
    ],
    resources: [
      { label: "FDA device regulatory pathways", url: "https://www.fda.gov/medical-devices/how-study-and-market-your-device" },
      { label: "FDA drug approval process", url: "https://www.fda.gov/patients/drug-development-process" },
      { label: "EMA regulatory guidance", url: "https://www.ema.europa.eu/en/human-regulatory/research-development" },
    ],
    courses: ["how-investors-evaluate-startups", "capital-strategy-foundations"],
  },

  "No clinical data or efficacy metrics": {
    analystNote: "Life science investors evaluate efficacy and safety data the way commercial investors evaluate MRR — it is the core quantitative signal. Even early preclinical data (in vitro, animal model results) should be presented numerically. Narrative-only descriptions ('promising results', 'strong safety profile') are red flags that suggest data may not support the story.",
    steps: [
      "Present your best efficacy data numerically: % response rate, fold-change, p-value, confidence interval",
      "Include a safety summary: adverse events observed, tolerability profile, NOAEL if applicable",
      "Show a data table or chart comparing your results to the standard of care or competitors",
      "Reference the study design: n=X animals/patients, dose, route of administration, duration",
      "If data is preliminary, label it honestly and explain the next study that will confirm it",
    ],
    resources: [
      { label: "PubMed (scientific literature reference)", url: "https://pubmed.ncbi.nlm.nih.gov" },
      { label: "FDA guidance on clinical endpoints", url: "https://www.fda.gov/regulatory-information/search-fda-guidance-documents" },
    ],
    courses: ["how-investors-evaluate-startups"],
  },
};

function buildRecommendations(factorScores: Record<FactorKey, FactorScore>): Recommendation[] {
  const recs: Recommendation[] = [];

  for (const f of READINESS_FACTORS) {
    const score = factorScores[f.key as FactorKey];
    if (!score) continue;
    const pct = score.pts / score.max;

    for (const flag of score.flags) {
      if (flag.severity !== "green") {
        const priority: "high" | "medium" | "low" =
          flag.severity === "red" ? "high" : pct < 0.6 ? "medium" : "low";

        const playbook = ANALYST_PLAYBOOK[flag.label];
        recs.push({
          priority,
          factor: f.label,
          action: flag.label,
          detail: flag.detail,
          analystNote: playbook?.analystNote ?? "This factor requires attention before investor meetings.",
          steps: playbook?.steps ?? ["Review this factor and upload supporting documentation."],
          resources: playbook?.resources ?? [],
          courses: resolveCourses(playbook?.courses ?? []),
        });
      }
    }
  }

  const order = { high: 0, medium: 1, low: 2 };
  return recs.sort((a, b) => order[a.priority] - order[b.priority]).slice(0, 15);
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

function OverviewTab({
  factorScores,
  setActiveKey,
  displayScore,
  mainColor,
}: {
  factorScores: Record<FactorKey, FactorScore>;
  setActiveKey: (k: FactorKey) => void;
  displayScore: number;
  mainColor: string;
}) {
  return (
    <>
      <div className="px-4 py-3">
        <p className="mb-3 px-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Factor breakdown — click to expand
        </p>
        {READINESS_FACTORS.map((f) => {
          const score = factorScores[f.key as FactorKey];
          if (!score) return null;
          const color = FACTOR_COLORS[f.key] ?? "#378ADD";
          const pct = score.pts / score.max;
          return (
            <button
              key={f.key}
              onClick={() => setActiveKey(f.key as FactorKey)}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            >
              <span className="min-w-0 flex-1 truncate text-sm text-slate-600">{f.label}</span>
              <div className="hidden w-24 sm:block">
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full" style={{ width: `${pct * 100}%`, background: color }} />
                </div>
              </div>
              <span className="w-8 text-right text-sm font-medium" style={{ color }}>{score.pts}</span>
              <span className="text-xs text-slate-400">/ {f.max}</span>
              <span className="text-slate-300">›</span>
            </button>
          );
        })}
      </div>
      <div className="border-t border-slate-100 px-6 py-4 flex items-center justify-between">
        <span className="text-sm font-medium text-slate-700">Total</span>
        <span className="text-lg font-semibold" style={{ color: mainColor }}>
          {displayScore}
          <span className="ml-1 text-sm font-normal text-slate-400">/ 100</span>
        </span>
      </div>
    </>
  );
}

function RecommendationCard({ rec, index }: { rec: Recommendation; index: number }) {
  const [open, setOpen] = useState(index === 0);

  const priorityConfig = {
    high:   { dot: "bg-red-400",   badge: "bg-red-50 text-red-700 ring-red-100",     label: "Critical",  border: "border-red-200",   header: "bg-red-50/60"   },
    medium: { dot: "bg-amber-400", badge: "bg-amber-50 text-amber-700 ring-amber-100", label: "Suggested", border: "border-amber-200", header: "bg-amber-50/60" },
    low:    { dot: "bg-slate-300", badge: "bg-slate-100 text-slate-600 ring-slate-200", label: "Optional",  border: "border-slate-200", header: "bg-slate-50/60" },
  };
  const cfg = priorityConfig[rec.priority];

  return (
    <div className={`rounded-xl border ${cfg.border} overflow-hidden`}>
      {/* Header row — always visible, click to expand */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full text-left flex items-start gap-3 px-4 py-3.5 ${cfg.header} transition-colors`}
      >
        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${cfg.dot}`} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${cfg.badge}`}>
              {cfg.label}
            </span>
            <span className="text-xs text-slate-400">{rec.factor}</span>
          </div>
          <p className="text-sm font-semibold text-slate-800">{rec.action}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{rec.detail}</p>
        </div>
        <span className="mt-1 shrink-0 text-slate-400 text-xs">{open ? "▲" : "▼"}</span>
      </button>

      {/* Expanded body */}
      {open && (
        <div className="border-t border-slate-100 bg-white px-4 py-4 space-y-4">

          {/* Analyst note */}
          <div className="rounded-lg bg-indigo-50 border border-indigo-100 px-4 py-3">
            <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide mb-1">Why investors care</p>
            <p className="text-xs leading-relaxed text-indigo-800">{rec.analystNote}</p>
          </div>

          {/* Action steps */}
          <div>
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Action steps</p>
            <ol className="space-y-2">
              {rec.steps.map((step, i) => (
                <li key={i} className="flex gap-2.5 text-xs text-slate-600 leading-relaxed">
                  <span className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-white text-[10px] font-bold">
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Resources */}
          {rec.resources.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">Helpful resources</p>
              <div className="flex flex-wrap gap-2">
                {rec.resources.map((r, i) =>
                  r.url ? (
                    <a
                      key={i}
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 hover:border-indigo-200 transition-colors"
                    >
                      {r.label}
                      <span className="text-slate-300">↗</span>
                    </a>
                  ) : (
                    <span
                      key={i}
                      className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600"
                    >
                      {r.label}
                    </span>
                  )
                )}
              </div>
            </div>
          )}

          {/* eLearning courses */}
          {rec.courses.length > 0 && (
            <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-4 py-3">
              <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-2">📚 Recommended courses on CapitalOS</p>
              <div className="flex flex-col gap-1.5">
                {rec.courses.map((c) => (
                  <a
                    key={c.slug}
                    href={`/investor/learning/${c.slug}`}
                    className="flex items-center gap-2 text-xs font-medium text-emerald-800 hover:text-emerald-600 transition-colors group"
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white text-[9px] font-bold group-hover:bg-emerald-500 transition-colors">
                      ▶
                    </span>
                    {c.title}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RecommendationsTab({ factorScores }: { factorScores: Record<FactorKey, FactorScore> }) {
  const recs = buildRecommendations(factorScores);

  const high = recs.filter((r) => r.priority === "high");
  const medium = recs.filter((r) => r.priority === "medium");
  const low = recs.filter((r) => r.priority === "low");

  if (recs.length === 0) {
    return (
      <div className="px-6 py-10 text-center">
        <p className="text-3xl">🎉</p>
        <p className="mt-2 text-sm font-medium text-slate-700">No critical gaps found</p>
        <p className="mt-1 text-xs text-slate-400">This company scores well across all factors.</p>
      </div>
    );
  }

  const Section = ({ title, items, startIndex }: { title: string; items: Recommendation[]; startIndex: number }) =>
    items.length === 0 ? null : (
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 px-1">{title}</p>
        {items.map((rec, i) => (
          <RecommendationCard key={startIndex + i} rec={rec} index={startIndex + i} />
        ))}
      </div>
    );

  return (
    <div className="px-4 py-4 space-y-5">
      <p className="text-xs text-slate-500 leading-relaxed">
        Analyst-level guidance on each gap — click any item to expand action steps, investor context, and resources.
      </p>
      <Section title="Critical — address before investor meetings" items={high} startIndex={0} />
      <Section title="Suggested improvements" items={medium} startIndex={high.length} />
      <Section title="Nice to have" items={low} startIndex={high.length + medium.length} />
    </div>
  );
}

function HistoryTab({ history }: { history: Array<{ score: number; scoredAt: string }> }) {
  if (history.length === 0) {
    return (
      <div className="px-6 py-10 text-center text-sm text-slate-400">No score history yet.</div>
    );
  }

  const max = Math.max(...history.map((h) => h.score));
  const min = Math.min(...history.map((h) => h.score));
  const range = max - min || 20;

  // Reverse so oldest is left
  const ordered = [...history].reverse();
  const W = 420;
  const H = 100;
  const pad = { l: 32, r: 12, t: 10, b: 24 };
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;

  const points = ordered.map((h, i) => {
    const x = pad.l + (i / Math.max(ordered.length - 1, 1)) * innerW;
    const y = pad.t + innerH - ((h.score - min) / range) * innerH;
    return { x, y, score: h.score, date: h.scoredAt };
  });

  const polyline = points.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <div className="px-6 py-4 space-y-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Score over time</p>
      <div className="overflow-hidden rounded-xl border border-slate-100 bg-slate-50 p-3">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 120 }}>
          {/* Grid lines */}
          {[0, 0.5, 1].map((t) => {
            const y = pad.t + innerH - t * innerH;
            return (
              <g key={t}>
                <line x1={pad.l} y1={y} x2={W - pad.r} y2={y} stroke="#E2E8F0" strokeWidth="1" strokeDasharray="3,3" />
                <text x={pad.l - 4} y={y + 4} textAnchor="end" fontSize="9" fill="#94A3B8">
                  {Math.round(min + t * range)}
                </text>
              </g>
            );
          })}
          {/* Line */}
          <polyline
            points={polyline}
            fill="none"
            stroke="#6366F1"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Dots */}
          {points.map((p, i) => (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r="4" fill="#6366F1" />
              <title>{`${p.score} pts · ${new Date(p.date).toLocaleDateString()}`}</title>
            </g>
          ))}
          {/* X-axis dates */}
          {ordered.map((h, i) => {
            const x = pad.l + (i / Math.max(ordered.length - 1, 1)) * innerW;
            if (i > 0 && i < ordered.length - 1 && ordered.length > 4) return null;
            return (
              <text key={i} x={x} y={H - 4} textAnchor="middle" fontSize="8" fill="#94A3B8">
                {new Date(h.scoredAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </text>
            );
          })}
        </svg>
      </div>

      {/* Table */}
      <div className="divide-y divide-slate-100 rounded-xl border border-slate-100">
        {history.map((h, i) => {
          const color = scoreColor(h.score / 100);
          return (
            <div key={i} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-xs text-slate-400">
                  {new Date(h.scoredAt).toLocaleDateString(undefined, {
                    year: "numeric", month: "short", day: "numeric",
                  })}
                </p>
                {i === 0 && <span className="text-xs font-medium text-indigo-500">Latest</span>}
              </div>
              <div className="flex items-center gap-3">
                <div className="w-20 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full" style={{ width: `${h.score}%`, background: color }} />
                </div>
                <span className="w-10 text-right text-sm font-semibold" style={{ color }}>
                  {h.score}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ComparisonTab({
  displayScore,
  platformAvg,
  percentile,
  mainColor,
}: {
  displayScore: number;
  platformAvg: number | null;
  percentile: number | null;
  mainColor: string;
}) {
  const diff = platformAvg !== null ? displayScore - platformAvg : null;

  return (
    <div className="px-6 py-4 space-y-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Platform comparison</p>

      {/* Percentile banner */}
      {percentile !== null && (
        <div className="rounded-2xl bg-indigo-50 px-5 py-4 text-center">
          <p className="text-5xl font-semibold text-indigo-600">{percentile}th</p>
          <p className="mt-1 text-sm text-indigo-500">percentile on this platform</p>
          <p className="mt-0.5 text-xs text-indigo-400">
            Scores higher than {percentile}% of companies
          </p>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3 text-center">
          <p className="text-2xl font-semibold" style={{ color: mainColor }}>{displayScore}</p>
          <p className="mt-0.5 text-xs text-slate-400">This company</p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3 text-center">
          <p className="text-2xl font-semibold text-slate-700">{platformAvg ?? "—"}</p>
          <p className="mt-0.5 text-xs text-slate-400">Platform avg</p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3 text-center">
          {diff !== null ? (
            <p className={`text-2xl font-semibold ${diff >= 0 ? "text-emerald-600" : "text-red-500"}`}>
              {diff >= 0 ? "+" : ""}{diff}
            </p>
          ) : (
            <p className="text-2xl font-semibold text-slate-300">—</p>
          )}
          <p className="mt-0.5 text-xs text-slate-400">vs avg</p>
        </div>
      </div>

      {/* Gauge bar */}
      {platformAvg !== null && (
        <div>
          <div className="relative h-3 overflow-hidden rounded-full bg-slate-100">
            <div
              className="absolute top-0 left-0 h-full rounded-full transition-all"
              style={{ width: `${displayScore}%`, background: mainColor }}
            />
            {/* Platform avg marker */}
            <div
              className="absolute top-0 h-full w-0.5 bg-slate-500"
              style={{ left: `${platformAvg}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between text-xs text-slate-400">
            <span>0</span>
            <span className="text-slate-500" style={{ position: "relative", left: `${platformAvg - 50}%` }}>
              Avg {platformAvg}
            </span>
            <span>100</span>
          </div>
        </div>
      )}

      {platformAvg === null && (
        <p className="text-center text-xs text-slate-400">
          Platform data not yet available.
        </p>
      )}
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function InvestableReadinessPanel({
  companyName,
  totalScore,
  factorScores,
  effectiveScore,
  isOverridden = false,
  scoredAt,
  scoreHistory = [],
  platformAvg = null,
  percentile = null,
}: Props) {
  const [activeKey, setActiveKey] = useState<FactorKey | null>(null);
  const [tab, setTab] = useState<Tab>("overview");

  const displayScore = effectiveScore ?? totalScore;
  const scorePct = displayScore / 100;
  const mainColor = scoreColor(scorePct);

  const TABS: { id: Tab; label: string }[] = [
    { id: "overview",         label: "Overview" },
    { id: "recommendations",  label: "Recommendations" },
    { id: "history",          label: "History" },
    { id: "comparison",       label: "Comparison" },
  ];

  return (
    <>
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm print:shadow-none print:border-slate-300">
        {/* Header */}
        <div className="border-b border-slate-100 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">
                Investable Readiness Score
              </p>
              <p className="mt-0.5 text-sm text-slate-500">{companyName}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="text-4xl font-semibold" style={{ color: mainColor }}>
                  {displayScore}
                </span>
                <span className="ml-1 text-lg text-slate-400">/ 100</span>
                {isOverridden && (
                  <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600">
                    Admin override
                  </span>
                )}
              </div>
              {/* PDF export button */}
              <button
                onClick={() => window.print()}
                className="print:hidden rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors"
                title="Export as PDF"
              >
                ↓ PDF
              </button>
            </div>
          </div>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${scorePct * 100}%`, background: mainColor }}
            />
          </div>
          {scoredAt && (
            <p className="mt-2 text-xs text-slate-400">
              Rule-based scoring · {new Date(scoredAt).toLocaleDateString()}
            </p>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-0 border-b border-slate-100 print:hidden">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 py-3 text-xs font-medium transition-colors ${
                tab === t.id
                  ? "border-b-2 border-indigo-500 text-indigo-600"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === "overview" && (
          <OverviewTab
            factorScores={factorScores}
            setActiveKey={setActiveKey}
            displayScore={displayScore}
            mainColor={mainColor}
          />
        )}
        {tab === "recommendations" && <RecommendationsTab factorScores={factorScores} />}
        {tab === "history" && <HistoryTab history={scoreHistory} />}
        {tab === "comparison" && (
          <ComparisonTab
            displayScore={displayScore}
            platformAvg={platformAvg}
            percentile={percentile}
            mainColor={mainColor}
          />
        )}
      </div>

      {/* Print-only: full factor list (always visible in PDF) */}
      <div className="hidden print:block mt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Factor Breakdown</p>
        {READINESS_FACTORS.map((f) => {
          const score = factorScores[f.key as FactorKey];
          if (!score) return null;
          const color = FACTOR_COLORS[f.key] ?? "#378ADD";
          return (
            <div key={f.key} className="flex items-center gap-3 py-1.5 border-b border-slate-100">
              <span className="flex-1 text-sm text-slate-600">{f.label}</span>
              <span className="text-sm font-medium" style={{ color }}>{score.pts} / {score.max}</span>
            </div>
          );
        })}
      </div>

      {/* Factor modal */}
      {activeKey && factorScores[activeKey] && (
        <FactorModal
          factorKey={activeKey}
          score={factorScores[activeKey]}
          onClose={() => setActiveKey(null)}
        />
      )}
    </>
  );
}
