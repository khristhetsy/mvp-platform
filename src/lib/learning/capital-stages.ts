/**
 * Capital Stage E-Learning System
 * Stage 0 (Foundation/pre-seed) → Stage 1 (Seed) → Stage 2 (Series A) → Stage 3 (Exit)
 * 80% completion unlocks next stage; admin can override per-founder.
 */

export type CapitalStage = "stage_0" | "stage_1" | "stage_2" | "stage_3";

export const CAPITAL_STAGE_UNLOCK_THRESHOLD = 80;

export const CAPITAL_STAGE_META: Record<
  CapitalStage,
  {
    label: string;
    subtitle: string;
    level: string;
    color: string;
    bgColor: string;
    borderColor: string;
    icon: string;
    deliverable: { id: string; title: string; description: string };
  }
> = {
  stage_0: {
    label: "Stage 0 — Foundation",
    subtitle: "Pre-fundraise basics",
    level: "Beginner",
    color: "#534AB7",
    bgColor: "#EEEDFE",
    borderColor: "#C7C4F0",
    icon: "🏗️",
    deliverable: {
      id: "executive-summary",
      title: "Executive summary (1-pager)",
      description: "A single-page overview of your company, problem, solution, traction, and ask.",
    },
  },
  stage_1: {
    label: "Stage 1 — Seed Round",
    subtitle: "Early-stage fundraising",
    level: "Intermediate",
    color: "#3B6D11",
    bgColor: "#EAF3DE",
    borderColor: "#BBE0A7",
    icon: "🌱",
    deliverable: {
      id: "pitch-deck",
      title: "Investor pitch deck (10–12 slides)",
      description: "A complete pitch deck covering problem, solution, market, traction, team, and ask.",
    },
  },
  stage_2: {
    label: "Stage 2 — Series A",
    subtitle: "Institutional fundraising",
    level: "Advanced",
    color: "#92400E",
    bgColor: "#FEF3C7",
    borderColor: "#FCD34D",
    icon: "🚀",
    deliverable: {
      id: "series-a-data-room",
      title: "Series A data room (complete)",
      description: "Full data room with financials, legal, cap table, contracts, and KPIs.",
    },
  },
  stage_3: {
    label: "Stage 3 — Exit",
    subtitle: "Exit planning & execution",
    level: "Expert",
    color: "#1E3A5F",
    bgColor: "#E8F0F8",
    borderColor: "#9DB3CC",
    icon: "🏆",
    deliverable: {
      id: "exit-readiness-report",
      title: "Exit readiness report",
      description: "A strategic exit memo covering valuation, buyer landscape, process, and timeline.",
    },
  },
};

export type CapitalLesson = {
  id: string;
  title: string;
  durationMinutes: number;
  summary: string;
  keyPoints: string[];
  worksheetPrompt?: string;
};

export type CapitalModule = {
  slug: string;
  stage: CapitalStage;
  title: string;
  lessons: CapitalLesson[];
};

/** All Stage 0–3 modules with lessons. Used for progress tracking via founder_lesson_progress. */
export const CAPITAL_STAGE_MODULES: CapitalModule[] = [
  // ── Stage 0: Foundation ─────────────────────────────────
  {
    slug: "cs0-fundraise-story",
    stage: "stage_0",
    title: "Your fundraise story",
    lessons: [
      {
        id: "fs-why-raise",
        title: "Why you're raising capital",
        durationMinutes: 15,
        summary: "Define your fundraise purpose, amount, and use of funds before talking to any investor.",
        keyPoints: [
          "Investors want to know exactly what you'll do with their money and why now.",
          "Use of funds should tie directly to a milestone that de-risks the business.",
          "Vague answers ('growth', 'marketing') kill credibility in first meetings.",
        ],
        worksheetPrompt: "Write a 3-sentence fundraise narrative: why you're raising, how much, and what milestone it funds.",
      },
      {
        id: "fs-problem-solution",
        title: "Problem–solution clarity",
        durationMinutes: 12,
        summary: "Investors fund solutions to real, painful problems. Learn how to articulate yours.",
        keyPoints: [
          "Name a specific, painful problem with evidence (user quotes, data, your own experience).",
          "Your solution must directly eliminate the pain — not just improve things slightly.",
          "The 'why now' question matters: what changed that makes this solvable today?",
        ],
        worksheetPrompt: "Write your problem statement in one sentence and your solution in one sentence.",
      },
    ],
  },
  {
    slug: "cs0-cap-table-101",
    stage: "stage_0",
    title: "Cap table 101",
    lessons: [
      {
        id: "ct-basics",
        title: "What is a cap table?",
        durationMinutes: 10,
        summary: "Your cap table is your ownership ledger. Every investor will examine it closely.",
        keyPoints: [
          "A cap table lists every shareholder, their share class, number of shares, and ownership %.",
          "Messy or incorrect cap tables are a common reason deals fall apart in diligence.",
          "Use a tool (Carta, Pulley, or a clean spreadsheet) from day one.",
        ],
        worksheetPrompt: "List your current shareholders, their share type, and approximate % ownership.",
      },
      {
        id: "ct-dilution",
        title: "Dilution and why it matters",
        durationMinutes: 12,
        summary: "Every new round dilutes existing shareholders. Understanding this protects you at the negotiation table.",
        keyPoints: [
          "Dilution = your % ownership decreases when new shares are issued.",
          "Dilution isn't bad if the company's value grows faster than your % shrinks.",
          "Pre-money vs post-money valuation determines how much you dilute.",
        ],
        worksheetPrompt: "If you raise $500K at a $2M pre-money valuation, what % does the investor receive? What's your new ownership if you started at 80%?",
      },
    ],
  },
  {
    slug: "cs0-investor-types",
    stage: "stage_0",
    title: "Investor types overview",
    lessons: [
      {
        id: "it-angels-vcs",
        title: "Angels vs VCs vs family offices",
        durationMinutes: 12,
        summary: "Each investor type has different check sizes, timelines, and expectations. Match your raise to the right type.",
        keyPoints: [
          "Angels write personal checks ($10K–$250K), move fast, ask fewer questions.",
          "VCs manage institutional funds ($500K–$5M+ per deal), require board seats, move slowly.",
          "Family offices are like wealthy angels with institutional processes — check sizes vary widely.",
        ],
        worksheetPrompt: "Based on your raise amount and timeline, which investor type is your best fit? List 3 reasons.",
      },
    ],
  },
  {
    slug: "cs0-term-sheet-basics",
    stage: "stage_0",
    title: "Term sheet basics",
    lessons: [
      {
        id: "ts-key-terms",
        title: "Understanding key term sheet terms",
        durationMinutes: 18,
        summary: "A term sheet is not just a formality. Valuation, pro-rata rights, and liquidation preferences can cost you millions.",
        keyPoints: [
          "Valuation (pre-money): the agreed company value before the investment comes in.",
          "Pro-rata rights: investor's right to participate in future rounds to maintain their %.",
          "Liquidation preference: who gets paid first if the company is sold.",
          "Anti-dilution: protects investors if future rounds are at a lower valuation.",
        ],
        worksheetPrompt: "Look up a standard SAFE note template. Identify: (1) the valuation cap, (2) the discount rate, and (3) what triggers conversion.",
      },
    ],
  },

  // ── Stage 1: Seed Round ──────────────────────────────────
  {
    slug: "cs1-financial-model",
    stage: "stage_1",
    title: "Financial model fundamentals",
    lessons: [
      {
        id: "fm-3year",
        title: "Building a 3-year financial model",
        durationMinutes: 20,
        summary: "Every seed investor wants to see a financial model. It doesn't need to be perfect — it needs to be logical.",
        keyPoints: [
          "Start with revenue: how many customers × average revenue per customer × growth rate.",
          "Work down from revenue to EBITDA. Show major cost categories clearly.",
          "Include your cash burn rate and when you'll run out of money (runway).",
          "Sensitivity analysis: what if growth is 50% slower? Show you've thought about it.",
        ],
        worksheetPrompt: "Build a simple 12-month P&L: revenue, COGS, gross profit, operating expenses, net income. Use real or estimated numbers.",
      },
      {
        id: "fm-unit-economics",
        title: "Unit economics that matter",
        durationMinutes: 18,
        summary: "LTV:CAC ratio is the single most-watched number by seed-stage investors.",
        keyPoints: [
          "LTV (Lifetime Value) = average revenue per customer × average lifespan.",
          "CAC (Customer Acquisition Cost) = total sales & marketing spend ÷ new customers acquired.",
          "LTV:CAC of 3:1 or higher is generally considered healthy.",
          "Payback period: how many months until CAC is recovered from a customer's payments.",
        ],
        worksheetPrompt: "Calculate your LTV and CAC. What is your LTV:CAC ratio? Is it above 3:1?",
      },
    ],
  },
  {
    slug: "cs1-pitch-deck",
    stage: "stage_1",
    title: "Pitch deck structure",
    lessons: [
      {
        id: "pd-10slides",
        title: "The 10-slide seed pitch deck",
        durationMinutes: 15,
        summary: "The best pitch decks follow a clear narrative arc. Each slide has a job.",
        keyPoints: [
          "Slide 1: Cover (company name, tagline, contact).",
          "Slides 2–4: Problem, Solution, Why now.",
          "Slides 5–7: Market size, Business model, Traction.",
          "Slides 8–10: Team, Financials + raise ask, Closing.",
        ],
        worksheetPrompt: "Draft a one-sentence headline for each of the 10 slides in your deck.",
      },
      {
        id: "pd-visual",
        title: "Design and visual storytelling",
        durationMinutes: 12,
        summary: "Investors see 1,000 decks a year. Clarity and simplicity win over decoration.",
        keyPoints: [
          "One idea per slide. If you're tempted to add a second point, make a second slide.",
          "Use data visualizations instead of tables wherever possible.",
          "Keep font size above 20pt. If it's unreadable on a phone, it's too small.",
          "White space is not wasted space — it reduces cognitive load.",
        ],
        worksheetPrompt: "Review your current deck (or draft). Identify 3 slides that are overcrowded and simplify each.",
      },
    ],
  },
  {
    slug: "cs1-valuation",
    stage: "stage_1",
    title: "Valuation anchoring methods",
    lessons: [
      {
        id: "val-methods",
        title: "Revenue multiples and comparables",
        durationMinutes: 25,
        summary: "Your valuation needs to be defensible. Anchoring to a comparable or a multiple gives you a logical foundation.",
        keyPoints: [
          "SaaS companies: typically 5–12× ARR at seed, depending on growth rate and retention.",
          "Comparable transactions: find 2–3 similar companies that raised at known valuations.",
          "Berkus method: useful for pre-revenue — assigns value to team, idea, prototype, market, and sales.",
          "Anchor high with a single number. A range signals uncertainty and invites negotiation to the bottom.",
        ],
        worksheetPrompt: "State your valuation ask and the method you're using to justify it. Find one comparable company deal.",
      },
      {
        id: "val-negotiate",
        title: "Negotiating valuation without losing the deal",
        durationMinutes: 15,
        summary: "Valuation is not the only lever. Knowing which terms matter most protects you better than fighting for a higher number.",
        keyPoints: [
          "SAFE notes defer valuation negotiation until your next priced round — often founder-friendly.",
          "If an investor pushes back on valuation, offer to discuss pro-rata rights instead.",
          "A lower valuation with a great investor is usually better than a higher valuation with a weak one.",
        ],
        worksheetPrompt: "What is your walk-away valuation? What terms would you accept at a lower valuation? Write your negotiation boundaries.",
      },
    ],
  },
  {
    slug: "cs1-investor-targeting",
    stage: "stage_1",
    title: "Investor targeting strategy",
    lessons: [
      {
        id: "it-icp",
        title: "Building your investor ICP",
        durationMinutes: 15,
        summary: "The best founders raise from investors who already invest in their stage, sector, and check size. Research first.",
        keyPoints: [
          "Define your investor ICP: stage (seed), sector (your industry), check size, geographic focus.",
          "Use Crunchbase, PitchBook, LinkedIn to identify 50–100 target investors.",
          "Prioritize investors with portfolio companies adjacent to yours — they understand your space.",
          "Warm introductions convert at 10× the rate of cold outreach.",
        ],
        worksheetPrompt: "List 20 investors who have invested in companies similar to yours in the last 3 years.",
      },
    ],
  },
  {
    slug: "cs1-data-room",
    stage: "stage_1",
    title: "Building your seed data room",
    lessons: [
      {
        id: "dr-essentials",
        title: "Data room essentials for seed",
        durationMinutes: 20,
        summary: "A clean, organized data room shows investors you're a professional operator. Disorganized rooms kill deals.",
        keyPoints: [
          "Seed data room minimum: cap table, financials (P&L + projections), pitch deck, product demo, team bios.",
          "Use a tool like Docsend, Notion, or Google Drive with view tracking.",
          "Never send documents attached to emails — it looks amateur and loses version control.",
          "Label every document clearly: 'CompanyName_CapTable_June2026.xlsx', not 'final_v3.xlsx'.",
        ],
        worksheetPrompt: "List every document you currently have and every document you're missing for a complete seed data room.",
      },
    ],
  },

  // ── Stage 2: Series A ────────────────────────────────────
  {
    slug: "cs2-institutional-diligence",
    stage: "stage_2",
    title: "Institutional due diligence prep",
    lessons: [
      {
        id: "id-legal",
        title: "Legal and corporate structure for Series A",
        durationMinutes: 25,
        summary: "Series A investors run 30–90 day legal diligence. Your corporate structure must be clean.",
        keyPoints: [
          "Delaware C-Corp is the standard. If you're not incorporated there, do it before Series A.",
          "All IP must be assigned to the company — founder IP assignment agreements are mandatory.",
          "No side agreements or undisclosed obligations. Investors' lawyers will find them.",
          "Board composition: typically 2 founders, 1 investor post-Series A. Establish board minutes.",
        ],
        worksheetPrompt: "Review your company's legal documents. Are all IP assignments signed? Is your cap table fully reflecting all outstanding shares, warrants, and options?",
      },
    ],
  },
  {
    slug: "cs2-series-a-metrics",
    stage: "stage_2",
    title: "Series A metrics and storytelling",
    lessons: [
      {
        id: "sa-kpis",
        title: "KPIs that Series A investors want",
        durationMinutes: 20,
        summary: "Series A is about proof. Investors want to see predictable growth, strong retention, and efficient acquisition.",
        keyPoints: [
          "MRR/ARR growth rate: ideally 15–20% month-over-month, or 3× year-over-year.",
          "Net Revenue Retention (NRR): above 100% means existing customers expand more than they churn.",
          "Payback period under 12 months. CAC efficiency under 1.5 months of payback.",
          "Cohort analysis: show investors that retention holds over 12+ months.",
        ],
        worksheetPrompt: "Calculate your NRR for the last 12 months. If NRR is below 100%, identify your top 3 churn reasons.",
      },
    ],
  },

  // ── Stage 3: Exit ────────────────────────────────────────
  {
    slug: "cs3-exit-planning",
    stage: "stage_3",
    title: "Exit planning fundamentals",
    lessons: [
      {
        id: "ep-types",
        title: "Exit types: M&A, IPO, secondary",
        durationMinutes: 20,
        summary: "Understanding your exit options early shapes your fundraising strategy, team, and operational priorities.",
        keyPoints: [
          "M&A (acquisition): most common exit for venture-backed companies. Strategics often pay premiums.",
          "IPO: only makes sense above $100M+ ARR with predictable, growing revenue.",
          "Secondary transactions: selling founder/early shares before a full exit. Available via SPVs, tender offers.",
          "Acqui-hire: company is acquired primarily for the team — common in downturns or pivots.",
        ],
        worksheetPrompt: "Which exit path is most realistic for your company in the next 5 years? List 3 potential strategic acquirers or IPO comps.",
      },
    ],
  },
  {
    slug: "cs3-valuation-exit",
    stage: "stage_3",
    title: "Valuation at exit",
    lessons: [
      {
        id: "ve-multiples",
        title: "Exit valuation multiples and precedents",
        durationMinutes: 22,
        summary: "Your exit valuation is determined by strategic value to the buyer, not just financial metrics.",
        keyPoints: [
          "Revenue multiples at exit vary by sector: SaaS (5–15×), FinTech (3–8×), Marketplace (2–6×).",
          "Strategic premium: acquirers often pay 20–40% more than financial buyers for strategic fit.",
          "EBITDA multiple: relevant once profitable. Typically 8–20× for growth-stage tech.",
          "Comparable transactions: essential reference — find 5 recent exits in your sector.",
        ],
        worksheetPrompt: "Based on your current revenue or ARR, calculate your estimated exit range using low (3×), mid (8×), and high (15×) multiples.",
      },
    ],
  },
];

/** Get all modules for a given capital stage */
export function getModulesForStage(stage: CapitalStage): CapitalModule[] {
  return CAPITAL_STAGE_MODULES.filter((m) => m.stage === stage);
}

/** Get total lesson count for a capital stage */
export function lessonCountForCapitalStage(stage: CapitalStage): number {
  return getModulesForStage(stage).reduce((sum, m) => sum + m.lessons.length, 0);
}

/** Compute completion % for a capital stage given a set of completed lesson keys */
export function computeCapitalStagePercent(
  stage: CapitalStage,
  completedKeys: Set<string>, // `${moduleSlug}:${lessonId}`
): number {
  const modules = getModulesForStage(stage);
  if (modules.length === 0) return 100;

  let total = 0;
  let completed = 0;

  for (const mod of modules) {
    for (const lesson of mod.lessons) {
      total++;
      if (completedKeys.has(`${mod.slug}:${lesson.id}`)) completed++;
    }
  }

  return total === 0 ? 100 : Math.round((completed / total) * 100);
}

/** Determine which stages are unlocked based on completion % and admin overrides */
export function computeCapitalStageAccess(
  completedKeys: Set<string>,
  overrides: Partial<Record<CapitalStage, boolean>>,
): Record<CapitalStage, boolean> {
  const stages: CapitalStage[] = ["stage_0", "stage_1", "stage_2", "stage_3"];

  const percents = Object.fromEntries(
    stages.map((s) => [s, computeCapitalStagePercent(s, completedKeys)]),
  ) as Record<CapitalStage, number>;

  return {
    stage_0: overrides.stage_0 ?? true, // always unlocked by default
    stage_1: overrides.stage_1 ?? percents.stage_0 >= CAPITAL_STAGE_UNLOCK_THRESHOLD,
    stage_2: overrides.stage_2 ?? percents.stage_1 >= CAPITAL_STAGE_UNLOCK_THRESHOLD,
    stage_3: overrides.stage_3 ?? percents.stage_2 >= CAPITAL_STAGE_UNLOCK_THRESHOLD,
  };
}

/** Get module by slug */
export function getCapitalModuleBySlug(slug: string): CapitalModule | null {
  return CAPITAL_STAGE_MODULES.find((m) => m.slug === slug) ?? null;
}

/** All module slugs across all stages */
export const ALL_CAPITAL_MODULE_SLUGS = CAPITAL_STAGE_MODULES.map((m) => m.slug);
