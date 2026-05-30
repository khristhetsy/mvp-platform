import type { LearningModuleContent } from "@/lib/learning/types";

function lesson(
  id: string,
  title: string,
  summary: string,
  keyPoints: string[],
  worksheetPrompt?: string,
) {
  return { id, title, summary, keyPoints, worksheetPrompt };
}

export const LEARNING_MODULE_CONTENT: Record<string, LearningModuleContent> = {
  "investor-ready-company-profiles": {
    slug: "investor-ready-company-profiles",
    objectives: [
      "Align company profile fields with institutional screening criteria",
      "Prepare for marketplace and admin review workflows",
    ],
    lessons: [
      lesson(
        "profile-screening",
        "How investors screen profiles",
        "Institutional investors evaluate fit in under two minutes using sector, stage, traction, and capital thesis signals.",
        [
          "Lead with sector, stage, and raise context above the fold",
          "Use consistent naming across deck, profile, and data room",
          "Avoid placeholder copy — reviewers flag incomplete profiles",
        ],
      ),
      lesson(
        "profile-checklist",
        "Profile completion checklist",
        "CapitalOS onboarding maps directly to investor-ready profile requirements.",
        [
          "Complete industry, geography, and business description",
          "Document founder goals and use of funds",
          "Submit for review only after core fields are investor-grade",
        ],
        "Worksheet: Audit your profile against the onboarding checklist.",
      ),
    ],
  },
  "writing-strong-company-descriptions": {
    slug: "writing-strong-company-descriptions",
    objectives: ["Write descriptions that survive institutional first-pass review"],
    lessons: [
      lesson(
        "description-structure",
        "Description structure",
        "Strong descriptions follow problem → solution → traction → market → capital ask.",
        [
          "Open with the customer problem in one sentence",
          "Quantify traction with credible metrics",
          "Close with why now and why this team",
        ],
      ),
      lesson(
        "description-revision",
        "Revision for diligence",
        "Admin and AI diligence compare narrative consistency across materials.",
        [
          "Match claims in your description to deck and financials",
          "Remove jargon that obscures the business model",
          "Target 120–200 words for marketplace profiles",
        ],
      ),
    ],
  },
  "startup-storytelling": {
    slug: "startup-storytelling",
    objectives: ["Translate product progress into investor-grade narrative"],
    lessons: [
      lesson(
        "story-arc",
        "Institutional story arc",
        "Investors fund inflection points, not feature lists.",
        ["Anchor on market shift", "Show proof of demand", "Connect milestones to capital deployment"],
      ),
      lesson(
        "proof-points",
        "Evidence-based proof points",
        "Every claim should map to a metric, customer quote, or contract signal.",
        ["Prefer leading indicators over vanity metrics", "Segment traction by ICP", "Explain churn and retention honestly"],
      ),
    ],
  },
  "pitch-deck-fundamentals": {
    slug: "pitch-deck-fundamentals",
    objectives: ["Build a diligence-ready pitch deck"],
    lessons: [
      lesson(
        "deck-structure",
        "Deck structure for institutions",
        "Institutional decks emphasize market, model, traction, team, and use of funds.",
        [
          "10–14 slides for first meetings",
          "Include clear ask and runway implications",
          "Upload the latest version to your document room",
        ],
      ),
      lesson(
        "deck-diligence",
        "Deck ↔ diligence alignment",
        "AI diligence cross-checks deck claims against uploaded financials and governance docs.",
        ["Reconcile revenue figures across sources", "Disclose known risks proactively", "Version-control deck updates"],
      ),
    ],
  },
  "financial-projections": {
    slug: "financial-projections",
    objectives: ["Model projections investors can diligence"],
    lessons: [
      lesson(
        "projection-basics",
        "Projection fundamentals",
        "Investors expect bottoms-up assumptions tied to operating reality.",
        ["3-year model with monthly detail for year one", "Separate ARR/MRR from cash", "Show sensitivity to key drivers"],
      ),
      lesson(
        "projection-upload",
        "Financial evidence in the data room",
        "Upload financial statements alongside projections for readiness scoring.",
        ["Include actuals vs plan variance", "Document assumptions in notes", "Align raise size with runway needs"],
      ),
    ],
  },
  "governance-basics": {
    slug: "governance-basics",
    objectives: ["Establish corporate hygiene for institutional review"],
    lessons: [
      lesson(
        "governance-core",
        "Core governance artifacts",
        "Funds expect clean cap table, charter, and board structure documentation.",
        ["Maintain updated cap table summary", "Document board composition and observers", "Upload corporate formation docs"],
      ),
      lesson(
        "governance-risk",
        "Governance risk flags",
        "Diligence reports surface governance gaps that block publication.",
        ["Resolve outstanding SAFE/note complexity", "Disclose related-party transactions", "Clarify voting control"],
      ),
    ],
  },
  "due-diligence-preparation": {
    slug: "due-diligence-preparation",
    objectives: ["Prepare for AI and admin diligence workflows"],
    lessons: [
      lesson(
        "dd-workflow",
        "Diligence workflow on CapitalOS",
        "Readiness combines document completeness, AI report, and admin review.",
        [
          "Complete document checklist before requesting analysis",
          "Review AI missing-document flags",
          "Track remediation tasks tied to diligence gaps",
        ],
      ),
      lesson(
        "dd-data-room",
        "Data room readiness",
        "Organize files by type so reviewers can verify claims quickly.",
        ["Label document types accurately", "Remove outdated versions", "Close gaps flagged in remediation"],
      ),
    ],
  },
  "compliance-readiness": {
    slug: "compliance-readiness",
    objectives: ["Navigate review submission and compliance checkpoints"],
    lessons: [
      lesson(
        "compliance-submit",
        "Submitting for investor readiness review",
        "Admin review gates marketplace visibility.",
        ["Complete onboarding before submission", "Ensure materials match disclosure standards", "Respond to change requests promptly"],
      ),
    ],
  },
  "investor-materials": {
    slug: "investor-materials",
    objectives: ["Assemble first-pass investor materials"],
    lessons: [
      lesson(
        "materials-package",
        "First-pass package",
        "Typical packages include deck, financials, corporate docs, and executive summary.",
        ["Prioritize pitch deck and financial statements", "Add product or market appendix when relevant", "Keep messaging consistent"],
      ),
    ],
  },
  "capital-raise-strategy": {
    slug: "capital-raise-strategy",
    objectives: ["Plan round strategy aligned to stage and traction"],
    lessons: [
      lesson(
        "raise-planning",
        "Raise planning",
        "Define target raise, timeline, and investor segments before outreach.",
        ["Set funding target in company profile", "Map use of funds to milestones", "Sequence outreach by investor type"],
      ),
    ],
  },
  "investor-psychology": {
    slug: "investor-psychology",
    objectives: ["Understand institutional evaluation criteria"],
    lessons: [
      lesson(
        "investor-lens",
        "The institutional lens",
        "Partners optimize for fund fit, ownership, and downside protection.",
        ["Articulate why your round fits their thesis", "Prepare for skepticism on market size", "Show path to follow-on readiness"],
      ),
    ],
  },
  "spvs-structured-capital": {
    slug: "spvs-structured-capital",
    objectives: ["Evaluate SPVs and structured vehicles"],
    lessons: [
      lesson(
        "spv-basics",
        "When SPVs apply",
        "SPVs can aggregate angels but add governance and compliance overhead.",
        ["Understand fee and carry implications", "Coordinate with lead investor expectations", "Document SPV terms clearly"],
      ),
    ],
  },
  "negotiation-fundamentals": {
    slug: "negotiation-fundamentals",
    objectives: ["Navigate term sheet and closing dynamics"],
    lessons: [
      lesson(
        "term-sheet",
        "Term sheet priorities",
        "Focus on valuation, pool, board, and protective provisions in order of impact.",
        ["Model dilution scenarios", "Understand pro-rata and MFN clauses", "Engage counsel before signing"],
      ),
    ],
  },
  "investor-outreach": {
    slug: "investor-outreach",
    objectives: ["Design credible investor outreach"],
    lessons: [
      lesson(
        "outreach-sequence",
        "Outreach sequencing",
        "Warm intros outperform cold blasts for institutional conversations.",
        ["Personalize with thesis fit", "Attach concise deck and metrics", "Track pipeline in founder workspace"],
      ),
    ],
  },
  "follow-up-strategy": {
    slug: "follow-up-strategy",
    objectives: ["Maintain investor pipeline momentum"],
    lessons: [
      lesson(
        "follow-up-cadence",
        "Follow-up cadence",
        "Structured follow-ups respect partner time while preserving momentum.",
        ["Send milestone updates, not status pings", "Reference prior conversation specifics", "Close loops on open diligence items"],
      ),
    ],
  },
  "investor-updates": {
    slug: "investor-updates",
    objectives: ["Publish investor-grade updates during the raise"],
    lessons: [
      lesson(
        "update-format",
        "Update format",
        "Effective updates cover KPIs, asks, risks, and next milestones.",
        ["Lead with metrics vs prior period", "Be transparent on challenges", "Include clear call-to-action"],
      ),
    ],
  },
  "meeting-preparation": {
    slug: "meeting-preparation",
    objectives: ["Prepare for partner and IC-style meetings"],
    lessons: [
      lesson(
        "meeting-prep",
        "Meeting preparation",
        "Institutional meetings test depth on market, model, and team.",
        ["Prepare appendix for diligence questions", "Rehearse 10-minute narrative", "Bring data room access ready"],
      ),
    ],
  },
  "board-readiness": {
    slug: "board-readiness",
    objectives: ["Prepare board governance for scale"],
    lessons: [
      lesson(
        "board-cadence",
        "Board cadence and materials",
        "Board-ready companies run consistent reporting rhythms.",
        ["Standardize board deck template", "Track action items across meetings", "Align metrics to strategic plan"],
      ),
    ],
  },
  "reporting-systems": {
    slug: "reporting-systems",
    objectives: ["Implement reporting systems post-close"],
    lessons: [
      lesson(
        "reporting-kpis",
        "KPI reporting",
        "Investors expect monthly KPI packs with variance commentary.",
        ["Define north-star and supporting metrics", "Automate data pulls where possible", "Document methodology changes"],
      ),
    ],
  },
  "institutional-diligence": {
    slug: "institutional-diligence",
    objectives: ["Operate through deep institutional diligence"],
    lessons: [
      lesson(
        "deep-dd",
        "Deep diligence phases",
        "Late-stage diligence spans legal, financial, commercial, and technical workstreams.",
        ["Assign owners per workstream", "Maintain issue log with remediation owners", "Preserve audit trail in data room"],
      ),
    ],
  },
  "long-term-capital-strategy": {
    slug: "long-term-capital-strategy",
    objectives: ["Plan multi-year capital strategy"],
    lessons: [
      lesson(
        "capital-roadmap",
        "Capital roadmap",
        "Series A readiness extends beyond a single raise event.",
        ["Map follow-on investor targets early", "Maintain reporting discipline between rounds", "Balance growth vs runway extension"],
      ),
    ],
  },
};

export function getModuleContent(slug: string): LearningModuleContent | null {
  return LEARNING_MODULE_CONTENT[slug] ?? null;
}

export function lessonCountForSlug(slug: string) {
  return LEARNING_MODULE_CONTENT[slug]?.lessons.length ?? 0;
}
