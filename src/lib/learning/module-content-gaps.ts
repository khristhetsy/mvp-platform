import type { LearningLesson, LearningModuleContent, LearningQuizQuestion } from "@/lib/learning/types";

function lesson(
  id: string,
  title: string,
  summary: string,
  keyPoints: string[],
  worksheetPrompt?: string,
): LearningLesson {
  return { id, title, summary, keyPoints, worksheetPrompt };
}

function quizLesson(
  id: string,
  title: string,
  summary: string,
  keyPoints: string[],
  questions: LearningQuizQuestion[],
): LearningLesson {
  return { id, title, summary, keyPoints, quiz: { passingScore: 70, questions } };
}

function q(
  id: string,
  prompt: string,
  correct: string,
  wrong: [string, string],
): LearningQuizQuestion {
  return {
    id,
    prompt,
    choices: [
      { id: "a", label: correct },
      { id: "b", label: wrong[0] },
      { id: "c", label: wrong[1] },
    ],
    correctChoiceId: "a",
  };
}

/** Full curriculum for modules that previously had sparse placeholder content. */
export const EXPANDED_MODULE_CONTENT: Record<string, LearningModuleContent> = {
  "governance-basics": {
    slug: "governance-basics",
    objectives: ["Establish corporate hygiene for institutional review"],
    lessons: [
      lesson(
        "governance-core",
        "Core governance artifacts",
        "Funds expect clean cap table, charter, and board structure documentation before term sheet diligence.",
        [
          "Maintain an updated cap table summary with fully diluted ownership",
          "Document board composition, observers, and voting agreements",
          "Upload formation documents and amendments to your data room",
        ],
        "Worksheet: List every governance document an institutional fund would request in week one.",
      ),
      lesson(
        "cap-table-hygiene",
        "Cap table hygiene",
        "Messy cap tables delay closings and create renegotiation risk at the term sheet stage.",
        [
          "Reconcile SAFEs, notes, and warrants to a single source of truth",
          "Flag side letters or non-standard rights before investor review",
          "Model dilution through your current raise before outreach",
        ],
      ),
      lesson(
        "board-structure",
        "Board structure fundamentals",
        "Institutional rounds typically reshape board composition — prepare before negotiations.",
        [
          "Define which decisions require board approval vs management",
          "Clarify observer rights vs full board seats",
          "Document committee charters if applicable",
        ],
      ),
      lesson(
        "governance-risk",
        "Governance risk flags",
        "Diligence reports surface governance gaps that block marketplace publication.",
        [
          "Resolve outstanding SAFE/note complexity or document conversion paths",
          "Disclose related-party transactions proactively",
          "Clarify voting control and protective provisions",
        ],
      ),
      quizLesson(
        "governance-quiz",
        "Readiness check: Governance basics",
        "Validate your understanding of institutional governance expectations.",
        ["Cap table accuracy is a first-week diligence item", "Board docs belong in the data room early"],
        [
          q("gq1", "What do funds typically request first in governance diligence?", "Updated cap table and formation documents", [
            "Founder personal tax returns only",
            "Marketing screenshots",
          ]),
          q("gq2", "Why disclose related-party transactions early?", "Builds trust and avoids late-stage surprises", [
            "They are never reviewed",
            "Only required after IPO",
          ]),
          q("gq3", "Platform readiness progress means:", "Improved investor preparation on iCapOS — not legal certification", [
            "Guaranteed funding approval",
            "SEC registration complete",
          ]),
        ],
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
        "Board-ready companies run consistent reporting rhythms that investors can rely on post-close.",
        [
          "Standardize a board deck template with KPI and financial sections",
          "Track action items and owners across meetings",
          "Align reported metrics to your strategic plan",
        ],
      ),
      lesson(
        "board-deck",
        "Board deck essentials",
        "Effective board materials balance transparency with decision-ready brevity.",
        [
          "Lead with KPIs vs prior period and plan",
          "Separate operational updates from strategic asks",
          "Include risk register changes since last meeting",
        ],
        "Worksheet: Outline your next board deck table of contents.",
      ),
      lesson(
        "board-governance",
        "Governance motions and minutes",
        "Institutional investors expect auditable decision trails.",
        [
          "Document resolutions for material transactions",
          "Maintain signed minutes or written consents",
          "Track stock option grants and board approvals",
        ],
      ),
      lesson(
        "board-scaling",
        "Scaling board composition",
        "As you raise, board dynamics shift — plan seat allocation before term sheet negotiation.",
        [
          "Map investor director rights to round size and ownership",
          "Consider independent director profile for later stages",
          "Balance founder control with investor oversight expectations",
        ],
      ),
      quizLesson(
        "board-quiz",
        "Readiness check: Board readiness",
        "Confirm you can run investor-grade board rhythms.",
        ["Consistent cadence builds post-close confidence", "Action item tracking prevents governance drift"],
        [
          q("bq1", "What should a board deck lead with?", "KPIs vs prior period and plan", ["Office photos", "Unrelated market trivia"]),
          q("bq2", "Why maintain signed minutes?", "Creates auditable decision trails for diligence", ["Only for public companies", "Optional for all startups"]),
          q("bq3", "When should you plan board seat allocation?", "Before term sheet negotiation on institutional rounds", ["After closing only", "Never"]),
        ],
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
        [
          "Personalize each note with thesis fit and stage alignment",
          "Attach a concise deck and two proof metrics",
          "Track pipeline stages in your founder workspace",
        ],
      ),
      lesson(
        "targeting",
        "Investor targeting",
        "Focus beats volume — institutions decline fast when fit is unclear.",
        [
          "Segment by sector, check size, and geography",
          "Prioritize funds with relevant portfolio companies",
          "Avoid spray-and-pray lists above your stage capacity",
        ],
        "Worksheet: Build a tier-1 list of 15 funds with thesis-fit notes.",
      ),
      lesson(
        "intro-paths",
        "Warm intro paths",
        "The best intros come from founders, operators, or existing investors who can vouch for you.",
        [
          "Map mutual connections via LinkedIn and portfolio founders",
          "Prepare a forwardable blurb for introducers",
          "Thank introducers with concise status updates",
        ],
      ),
      lesson(
        "outreach-copy",
        "Outreach copy that converts",
        "Partners skim — your first paragraph must earn the second.",
        [
          "Open with traction or inflection in one sentence",
          "State raise context and why this fund specifically",
          "End with a clear ask (15-minute call, not 'pick your brain')",
        ],
      ),
      quizLesson(
        "outreach-quiz",
        "Readiness check: Investor outreach",
        "Test your outreach fundamentals before live pipeline work.",
        ["Thesis fit beats volume", "Forwardable blurbs help warm intros"],
        [
          q("oq1", "What typically outperforms cold email blasts?", "Warm introductions with thesis fit", ["Mass CC lists", "Generic templates only"]),
          q("oq2", "What belongs in paragraph one?", "Traction or inflection in one sentence", ["Company founding story from childhood", "Full cap table"]),
          q("oq3", "Where should you track pipeline stages?", "Founder workspace CRM with structured follow-ups", ["Only in personal notes", "Nowhere"]),
        ],
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
        [
          "Send milestone updates, not status pings",
          "Reference prior conversation specifics",
          "Close loops on open diligence items",
        ],
      ),
      lesson(
        "pipeline-hygiene",
        "Pipeline hygiene",
        "Stale pipelines waste social capital and obscure real conversion rates.",
        [
          "Tag each investor by stage: contacted, meeting, diligence, pass",
          "Set next-action dates for every active thread",
          "Archive passes with a one-line reason for learning",
        ],
      ),
      lesson(
        "milestone-updates",
        "Milestone-based updates",
        "Investors respond to material progress — not weekly 'checking in' emails.",
        [
          "Trigger updates on revenue, product, or partnership milestones",
          "Include one ask when relevant (intro, feedback, meeting)",
          "Keep updates under 200 words for busy partners",
        ],
        "Worksheet: Draft a milestone update template for your next KPI beat.",
      ),
      quizLesson(
        "followup-quiz",
        "Readiness check: Follow-up strategy",
        "Ensure your follow-up discipline matches institutional expectations.",
        ["Milestone updates beat status pings", "Pipeline hygiene improves conversion learning"],
        [
          q("fq1", "What makes a strong follow-up?", "Milestone progress with specific prior context", ["Weekly 'just checking in'", "Identical blast to full list"]),
          q("fq2", "Why tag pass reasons?", "Improves targeting and narrative iteration", ["Partners require it legally", "No reason needed"]),
          q("fq3", "Ideal length for investor updates?", "Under 200 words for busy partners", ["10+ pages", "One word"]),
        ],
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
        [
          "Model dilution scenarios including option pool refresh",
          "Understand pro-rata and MFN clauses",
          "Engage counsel before signing any term sheet",
        ],
      ),
      lesson(
        "valuation-dynamics",
        "Valuation dynamics",
        "Price is one lever — structure and governance terms often matter more at seed/Series A.",
        [
          "Compare pre-money vs post-money option pool treatments",
          "Evaluate liquidation preference stack if prior rounds exist",
          "Anchor on comparable transactions in your sector and stage",
        ],
      ),
      lesson(
        "protective-provisions",
        "Protective provisions",
        "Investors use protective provisions to guard downside — know which are market vs aggressive.",
        [
          "Identify consent rights on major transactions",
          "Understand drag-along and tag-along implications",
          "Negotiate information rights vs operational burden",
        ],
      ),
      lesson(
        "closing-process",
        "Closing process",
        "Term sheet signature starts diligence — operational readiness accelerates close.",
        [
          "Assign internal owners for legal, financial, and IP workstreams",
          "Maintain a closing checklist with counsel",
          "Keep data room current through signing",
        ],
      ),
      quizLesson(
        "negotiation-quiz",
        "Readiness check: Negotiation fundamentals",
        "Validate term sheet literacy before live negotiations.",
        ["Counsel review is non-negotiable", "Structure can outweigh headline valuation"],
        [
          q("nq1", "What should you model before signing?", "Dilution including option pool refresh", ["Only headline valuation", "Founder hobbies"]),
          q("nq2", "When should counsel review a term sheet?", "Before signing", ["After wire", "Never for seed"]),
          q("nq3", "What accelerates close after term sheet?", "Assigned workstreams and current data room", ["Ignoring diligence requests", "Deleting cap table"]),
        ],
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
        [
          "Understand fee and carry implications for founders",
          "Coordinate with lead investor expectations on cap table",
          "Document SPV terms clearly for downstream diligence",
        ],
      ),
      lesson(
        "spv-governance",
        "SPV governance implications",
        "Multiple small vehicles can complicate voting and information rights.",
        [
          "Consolidate investor communications where possible",
          "Clarify pro-rata and side letter stacking",
          "Plan for SPV dissolution or roll-up at Series A",
        ],
      ),
      lesson(
        "structured-alternatives",
        "Structured alternatives",
        "Not every angel check requires an SPV — compare direct vs syndicated paths.",
        [
          "Evaluate platform syndicates vs bespoke SPVs",
          "Consider timing impact on institutional lead negotiations",
          "Review securities compliance with counsel",
        ],
      ),
      quizLesson(
        "spv-quiz",
        "Readiness check: SPVs & structured capital",
        "Confirm when structured vehicles help vs hurt your raise.",
        ["SPVs add overhead — use deliberately", "Lead investor alignment matters"],
        [
          q("sq1", "Primary tradeoff of SPVs for founders?", "Aggregation vs governance/compliance overhead", ["Free money", "No documentation"]),
          q("sq2", "What should you coordinate with a lead investor?", "Cap table and voting expectations", ["Office decor", "Social posts only"]),
          q("sq3", "Before using an SPV you should:", "Review securities compliance with counsel", ["Skip all documentation", "Hide terms from investors"]),
        ],
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
        "Effective updates cover KPIs, asks, risks, and next milestones in a scannable structure.",
        [
          "Lead with metrics vs prior period and plan",
          "Be transparent on challenges and mitigation",
          "Include a clear call-to-action when you need help",
        ],
      ),
      lesson(
        "kpi-selection",
        "KPI selection for updates",
        "Investors trust founders who pick honest north-star metrics for their business model.",
        [
          "Choose one primary KPI and 2–3 supporting metrics",
          "Explain methodology changes explicitly",
          "Avoid vanity metrics without cohort context",
        ],
      ),
      lesson(
        "update-cadence",
        "Update cadence",
        "Monthly during active raises; quarterly post-close unless otherwise agreed.",
        [
          "Set expectations with investors at term sheet",
          "Batch updates to reduce founder overhead",
          "Archive updates in your data room for diligence",
        ],
        "Worksheet: Draft your next investor update using the KPI → ask → risks format.",
      ),
      quizLesson(
        "updates-quiz",
        "Readiness check: Investor updates",
        "Ensure your update discipline builds institutional trust.",
        ["Transparency on risks builds credibility", "Metrics should beat narrative alone"],
        [
          q("uq1", "What should lead an investor update?", "KPIs vs prior period and plan", ["Unrelated anecdotes", "Empty section headers"]),
          q("uq2", "Typical cadence during an active raise?", "Monthly", ["Never", "Daily novels"]),
          q("uq3", "Why explain methodology changes?", "Maintains trust when numbers shift", ["Investors do not read updates", "Optional only"]),
        ],
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
        "Institutional meetings test depth on market, model, and team — not slide aesthetics alone.",
        [
          "Prepare appendix slides for diligence depth questions",
          "Rehearse a 10-minute narrative with crisp transitions",
          "Bring data room access ready for follow-up requests",
        ],
      ),
      lesson(
        "partner-questions",
        "Anticipating partner questions",
        "Partners probe weaknesses — rehearse answers on churn, competition, and unit economics.",
        [
          "Build a FAQ doc from prior meeting feedback",
          "Practice concise answers under 90 seconds",
          "Acknowledge unknowns with a plan to resolve",
        ],
      ),
      lesson(
        "ic-dynamics",
        "IC and committee dynamics",
        "Your champion must arm the partnership with materials that survive without you in the room.",
        [
          "Provide a one-page memo summarizing thesis and risks",
          "Supply customer references or pipeline proof points",
          "Follow up within 24 hours with promised materials",
        ],
      ),
      lesson(
        "meeting-debrief",
        "Post-meeting debrief",
        "Structured debriefs improve conversion on subsequent meetings.",
        [
          "Log objections and update your FAQ",
          "Send thank-you with specific next steps",
          "Track diligence items promised vs delivered",
        ],
      ),
      quizLesson(
        "meeting-quiz",
        "Readiness check: Meeting preparation",
        "Validate partner-meeting readiness before live conversations.",
        ["Depth beats slide count", "24-hour follow-up is standard"],
        [
          q("mq1", "What should you rehearse before a partner meeting?", "10-minute narrative with appendix depth", ["Only opening joke", "Unrelated product roadmap"]),
          q("mq2", "Why provide a one-page IC memo?", "Champion must advocate without you in the room", ["Not needed", "Replaces all diligence"]),
          q("mq3", "When should you send promised materials?", "Within 24 hours of the meeting", ["Next quarter", "Never"]),
        ],
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
        "Partners optimize for fund fit, ownership, and downside protection — not just excitement.",
        [
          "Articulate why your round fits their thesis and check size",
          "Prepare for skepticism on market size and timing",
          "Show path to follow-on readiness and milestone de-risking",
        ],
      ),
      lesson(
        "conviction-signals",
        "Conviction signals",
        "Investors pattern-match on traction quality, team depth, and market pull.",
        [
          "Lead with evidence of demand, not vision alone",
          "Demonstrate founder-market fit with specific decisions",
          "Show capital efficiency relative to stage norms",
        ],
      ),
      lesson(
        "risk-framing",
        "Risk framing",
        "Sophisticated founders name risks before investors do — with mitigation plans.",
        [
          "Maintain a living risk register with owners",
          "Connect risks to capital deployment milestones",
          "Avoid dismissing competitive threats without data",
        ],
      ),
      quizLesson(
        "psychology-quiz",
        "Readiness check: Investor psychology",
        "Align your narrative with how institutions actually decide.",
        ["Thesis fit is the first filter", "Naming risks builds credibility"],
        [
          q("pq1", "What do partners optimize for first?", "Fund fit, ownership, and downside protection", ["Founder popularity only", "Office location"]),
          q("pq2", "Strong conviction signals include:", "Evidence of demand and capital efficiency", ["Vision without metrics", "Ignoring competition"]),
          q("pq3", "How should you handle risks in meetings?", "Name them with mitigation plans", ["Deny all risks", "Change topic"]),
        ],
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
        "Investors expect monthly KPI packs with variance commentary against plan.",
        [
          "Define north-star and supporting metrics with clear definitions",
          "Automate data pulls where possible to reduce errors",
          "Document methodology changes in each reporting period",
        ],
      ),
      lesson(
        "financial-reporting",
        "Financial reporting cadence",
        "Cash, burn, and runway reporting should reconcile to your model and bank.",
        [
          "Share monthly P&L and cash balance vs budget",
          "Flag one-time items separately from run-rate",
          "Align board and investor reporting packages",
        ],
      ),
      lesson(
        "reporting-tooling",
        "Reporting tooling",
        "Systems reduce founder burden and improve investor confidence post-close.",
        [
          "Connect accounting and metrics sources to a single dashboard",
          "Version-control board and investor decks",
          "Set internal deadlines before external send dates",
        ],
        "Worksheet: Map your monthly reporting calendar with owners and deadlines.",
      ),
      lesson(
        "variance-commentary",
        "Variance commentary",
        "Investors read commentary for judgment — not just numbers.",
        [
          "Explain misses with corrective actions",
          "Highlight leading indicators turning positive",
          "Tie variances to strategic decisions explicitly",
        ],
      ),
      quizLesson(
        "reporting-quiz",
        "Readiness check: Reporting systems",
        "Confirm post-close reporting discipline.",
        ["Variance commentary shows judgment", "Single source of truth reduces errors"],
        [
          q("rq1", "What should monthly KPI packs include?", "Variance commentary against plan", ["Only logos", "Unrelated news"]),
          q("rq2", "Why automate metric pulls?", "Reduces errors and founder overhead", ["Investors forbid automation", "Not useful"]),
          q("rq3", "Financial reporting should reconcile to:", "Model and bank/cash reality", ["Social media followers", "Random estimates"]),
        ],
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
        "Late-stage diligence spans legal, financial, commercial, and technical workstreams in parallel.",
        [
          "Assign an internal owner per workstream",
          "Maintain an issue log with remediation owners and dates",
          "Preserve audit trail in the data room for all submissions",
        ],
      ),
      lesson(
        "legal-diligence",
        "Legal diligence readiness",
        "Counsel-led reviews focus on IP, contracts, employment, and corporate history.",
        [
          "Organize material contracts with change-of-control clauses highlighted",
          "Document IP assignment for all contributors",
          "Prepare cap table legal opinions path with counsel early",
        ],
      ),
      lesson(
        "commercial-diligence",
        "Commercial diligence",
        "Funds validate market, customers, and pipeline claims against primary research.",
        [
          "Prepare customer reference list with context",
          "Support pipeline claims with CRM exports",
          "Be ready to explain churn and expansion cohorts",
        ],
      ),
      lesson(
        "technical-diligence",
        "Technical diligence",
        "Technical reviewers assess architecture, security, and scalability risks.",
        [
          "Document architecture diagrams and key dependencies",
          "Share security practices and incident history honestly",
          "Identify technical debt with remediation roadmap",
        ],
      ),
      quizLesson(
        "institutional-quiz",
        "Readiness check: Institutional diligence",
        "Validate operating rhythm for deep diligence.",
        ["Parallel workstreams need owners", "Issue logs prevent surprise delays"],
        [
          q("iq1", "What accelerates deep diligence?", "Assigned owners per workstream and issue log", ["Ignoring requests", "Deleting data room files"]),
          q("iq2", "Legal diligence commonly reviews:", "IP, contracts, employment, corporate history", ["Only marketing colors", "Founder hobbies"]),
          q("iq3", "Commercial diligence validates:", "Market and customer claims via primary research", ["Only press releases", "Nothing"]),
        ],
      ),
    ],
  },
};
