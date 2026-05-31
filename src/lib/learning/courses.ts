import type { Course, CourseLesson, CourseSection } from "@/lib/learning/course-types";
import type { LearningQuizQuestion } from "@/lib/learning/types";

function lesson(
  slug: string,
  title: string,
  durationMinutes: number,
  content: string,
  keyPoints?: string[],
): CourseLesson {
  return { slug, title, durationMinutes, type: "lesson", content, keyPoints };
}

function quizLesson(
  slug: string,
  title: string,
  durationMinutes: number,
  content: string,
  questions: LearningQuizQuestion[],
): CourseLesson {
  return {
    slug,
    title,
    durationMinutes,
    type: "quiz",
    content,
    quiz: { passingScore: 70, questions },
  };
}

function section(slug: string, title: string, lessons: CourseLesson[]): CourseSection {
  return { slug, title, lessons };
}

const screeningQuiz = quizLesson(
  "investor-screening-basics",
  "Quiz: Investor screening basics",
  10,
  "Check your understanding of how institutional investors screen startups in a first pass.",
  [
    {
      id: "q1",
      prompt: "What do investors typically evaluate in an initial screen?",
      choices: [
        { id: "a", label: "Sector, stage, traction, and thesis fit" },
        { id: "b", label: "Founder vacation schedule" },
        { id: "c", label: "Office paint color" },
      ],
      correctChoiceId: "a",
    },
    {
      id: "q2",
      prompt: "Educational founder training on CapitalOS means:",
      choices: [
        { id: "a", label: "Investor preparation learning — not investment advice" },
        { id: "b", label: "Guaranteed funding approval" },
        { id: "c", label: "SEC registration is complete" },
      ],
      correctChoiceId: "a",
    },
  ],
);

export const FOUNDER_COURSES: Course[] = [
  {
    slug: "investor-readiness-masterclass",
    title: "Investor Readiness Masterclass",
    description: "A structured masterclass on how investors screen, evaluate, and engage with early-stage companies.",
    longDescription:
      "This educational course walks founders through institutional investor behavior, profile positioning, and credibility signals. Content is for founder training and investor preparation only — not legal, tax, securities, or investment advice.",
    instructor: "CapitalOS Faculty",
    category: "Investor Readiness",
    level: "Beginner",
    thumbnailAccent: "from-indigo-600 to-slate-900",
    whatYouWillLearn: [
      "How investors screen startups in under two minutes",
      "Common rejection patterns and how to avoid them",
      "How to position your company clearly for first-pass review",
      "Building an investor-grade company overview",
      "Presenting traction and credibility signals",
    ],
    sections: [
      section("understanding-investors", "Section 1: Understanding Investors", [
        lesson(
          "how-investors-screen-startups",
          "How investors screen startups",
          12,
          "Institutional investors run a fast first-pass screen: sector fit, stage, traction quality, team credibility, and capital thesis alignment. Your job in this lesson is to map your company to those signals explicitly — in your profile, deck, and data room — so reviewers do not have to guess.",
          [
            "Lead with sector, stage, and raise context",
            "Quantify traction with credible metrics",
            "Align narrative across profile, deck, and diligence materials",
          ],
        ),
        lesson(
          "what-investors-reject-immediately",
          "What investors reject immediately",
          11,
          "Common instant rejects include vague problem statements, inconsistent metrics, missing financial artifacts, incomplete profiles, and unclear use of funds. This lesson catalogs rejection patterns so you can audit your materials before outreach.",
          [
            "Incomplete or placeholder copy in public profiles",
            "Deck and financials that tell different stories",
            "No clear customer or revenue proof points",
          ],
        ),
        lesson(
          "position-company-clearly",
          "How to position your company clearly",
          14,
          "Positioning is a one-paragraph crisp statement: who you serve, what you deliver, why now, and why your team wins. Investors reward clarity because it reduces diligence friction.",
          [
            "Use problem → solution → traction → market → ask",
            "Remove jargon that hides the business model",
            "State your raise and use of funds in plain language",
          ],
        ),
        screeningQuiz,
      ]),
      section("building-investor-profile", "Section 2: Building Your Investor Profile", [
        lesson(
          "writing-company-overview",
          "Writing your company overview",
          13,
          "Your overview is the anchor artifact for marketplace and CRM workflows. Write 120–200 words that survive copy-paste into investor memos without rewriting.",
          ["Open with customer problem", "Show proof of demand", "Close with capital context"],
        ),
        lesson(
          "showing-traction-correctly",
          "Showing traction correctly",
          12,
          "Traction must be time-bounded, measurable, and source-consistent. Use metrics investors can diligence: revenue, growth rate, retention, pilots, or LOIs — labeled honestly.",
          ["Prefer leading indicators over vanity metrics", "Show period-over-period change", "Explain data sources"],
        ),
        lesson(
          "building-credibility-signals",
          "Building credibility signals",
          10,
          "Credibility signals include customers, advisors, partnerships, patents, and prior capital. Curate what strengthens your narrative without overcrowding the profile.",
          ["Highlight relevant operators and domain experts", "Link evidence in your document room"],
        ),
      ]),
    ],
  },
  {
    slug: "investor-ready-pitch-deck",
    title: "Building an Investor-Ready Pitch Deck",
    description: "Design and narrative structure for a first-meeting institutional deck.",
    longDescription:
      "Learn slide architecture, storytelling flow, and disclosure discipline for educational founder training. This is not securities compliance advice.",
    instructor: "CapitalOS Faculty",
    category: "Fundraising",
    level: "Beginner",
    thumbnailAccent: "from-violet-600 to-indigo-900",
    whatYouWillLearn: [
      "Standard 10–14 slide deck architecture",
      "Story flow investors expect",
      "Use of funds and milestone framing",
      "Uploading and versioning deck materials",
    ],
    sections: [
      section("deck-structure", "Section 1: Deck Architecture", [
        lesson(
          "slide-architecture",
          "Slide architecture for first meetings",
          14,
          "Institutional first meetings typically use 10–14 slides: problem, solution, market, product, traction, business model, competition, team, financials, ask, appendix discipline.",
        ),
        lesson(
          "story-flow",
          "Story flow and transitions",
          12,
          "Each slide should answer one investor question. Transitions should show causality: market shift → customer pain → product → traction → capital deployment.",
        ),
        lesson(
          "ask-and-use-of-funds",
          "Ask and use of funds",
          11,
          "State how much you are raising, instrument context at a high level, and milestone-linked use of funds. Educational only — consult qualified advisors for legal structuring.",
        ),
      ]),
      section("deck-operations", "Section 2: Deck Operations", [
        lesson(
          "versioning-and-upload",
          "Versioning and document room upload",
          9,
          "Maintain one canonical PDF in your document room; name files with date stamps; avoid sending conflicting versions to investors.",
        ),
        quizLesson(
          "pitch-deck-quiz",
          "Quiz: Pitch deck essentials",
          8,
          "Validate deck fundamentals.",
          [
            {
              id: "q1",
              prompt: "Typical first-meeting deck length:",
              choices: [
                { id: "a", label: "10–14 slides" },
                { id: "b", label: "50+ slides" },
                { id: "c", label: "1 slide" },
              ],
              correctChoiceId: "a",
            },
          ],
        ),
      ]),
    ],
  },
  {
    slug: "startup-financial-forecasting",
    title: "Startup Financial Forecasting",
    description: "Build investor-diligence-friendly forecasts and assumptions.",
    longDescription:
      "Founder training on projections, unit economics, and scenario framing for investor preparation — not tax or investment advice.",
    instructor: "CapitalOS Faculty",
    category: "Finance",
    level: "Intermediate",
    thumbnailAccent: "from-emerald-600 to-slate-900",
    whatYouWillLearn: [
      "Three-statement thinking at seed stage",
      "Driver-based assumptions",
      "Scenario and sensitivity basics",
      "Uploading financial artifacts",
    ],
    sections: [
      section("forecast-foundations", "Section 1: Forecast Foundations", [
        lesson(
          "driver-based-model",
          "Driver-based models",
          15,
          "Start from drivers: customers, pricing, conversion, churn, and COGS. Avoid spreadsheet fiction — tie every line to an operating assumption you can defend.",
        ),
        lesson(
          "unit-economics",
          "Unit economics overview",
          13,
          "CAC, LTV, payback, and gross margin tell investors whether the business model scales. Document assumptions clearly.",
        ),
      ]),
      section("investor-package", "Section 2: Investor Package", [
        lesson(
          "scenario-planning",
          "Scenario planning",
          12,
          "Present base, upside, and downside cases with explicit triggers. Investors respect intellectual honesty.",
        ),
        lesson(
          "financial-artifacts",
          "Financial artifacts in the data room",
          10,
          "Upload financial statements and forecast summaries to your document room so diligence teams can reconcile narrative and numbers.",
        ),
      ]),
    ],
  },
  {
    slug: "data-room-preparation",
    title: "Data Room Preparation",
    description: "Organize a diligence-ready document room for institutional review.",
    longDescription:
      "Educational course on folder structure, disclosure discipline, and completeness checks for investor preparation.",
    instructor: "CapitalOS Faculty",
    category: "Diligence",
    level: "Intermediate",
    thumbnailAccent: "from-sky-600 to-slate-900",
    whatYouWillLearn: [
      "Core diligence folders and artifacts",
      "Completeness workflows on CapitalOS",
      "Disclosure and versioning hygiene",
    ],
    sections: [
      section("room-structure", "Section 1: Room Structure", [
        lesson(
          "core-folders",
          "Core folders investors expect",
          12,
          "Corporate, financials, product, customers, legal summaries, and cap table context — organized and labeled consistently.",
        ),
        lesson(
          "completeness-check",
          "Completeness checks",
          11,
          "Use your readiness workspace to track missing artifacts before opening a formal diligence process.",
        ),
      ]),
      section("operations", "Section 2: Room Operations", [
        lesson(
          "version-control",
          "Version control and access",
          10,
          "One canonical version per artifact; dated filenames; controlled sharing through platform workflows.",
        ),
      ]),
    ],
  },
  {
    slug: "founder-governance-basics",
    title: "Founder Governance Basics",
    description: "Corporate hygiene and board-ready operating rhythms for founders.",
    longDescription:
      "Educational founder training on governance artifacts — not legal advice. Consult qualified counsel for entity-specific requirements.",
    instructor: "CapitalOS Faculty",
    category: "Governance",
    level: "Beginner",
    thumbnailAccent: "from-amber-600 to-slate-900",
    whatYouWillLearn: [
      "Board-ready documentation habits",
      "Meeting cadence and minutes discipline",
      "Cap table hygiene basics",
    ],
    sections: [
      section("governance-core", "Section 1: Governance Core", [
        lesson(
          "board-cadence",
          "Board and advisor cadence",
          11,
          "Regular meeting rhythms, decision logs, and action tracking reduce investor friction during diligence.",
        ),
        lesson(
          "corporate-records",
          "Corporate records discipline",
          12,
          "Maintain charters, consents, and option plan summaries in your document room for efficient review.",
        ),
      ]),
    ],
  },
  {
    slug: "fundraising-communication",
    title: "Fundraising Communication",
    description: "Investor updates, outreach tone, and institutional communication patterns.",
    longDescription:
      "Founder training on communication workflows — not investment recommendations or guaranteed outcomes.",
    instructor: "CapitalOS Faculty",
    category: "Communication",
    level: "Intermediate",
    thumbnailAccent: "from-rose-600 to-slate-900",
    whatYouWillLearn: [
      "Institutional update format",
      "Outreach sequencing",
      "Follow-up discipline",
    ],
    sections: [
      section("updates", "Section 1: Investor Updates", [
        lesson(
          "update-format",
          "Institutional update format",
          13,
          "Lead with headline metrics, milestones, asks, and risks. Keep updates scannable — investors review dozens per week.",
        ),
        lesson(
          "cadence-and-tone",
          "Cadence and tone",
          10,
          "Monthly or quarterly cadence builds trust. Tone should be factual, concise, and free of hype.",
        ),
      ]),
      section("outreach", "Section 2: Outreach", [
        lesson(
          "outreach-sequencing",
          "Outreach sequencing",
          12,
          "Warm intros, targeted CRM stages, and controlled messaging through platform workflows.",
        ),
      ]),
    ],
  },
  {
    slug: "how-investors-evaluate-startups",
    title: "How Investors Evaluate Startups",
    description: "Inside the institutional evaluation mindset — from screen to deep diligence.",
    longDescription:
      "Educational overview of evaluation frameworks used in institutional investing contexts. Not investment advice.",
    instructor: "CapitalOS Faculty",
    category: "Investor Readiness",
    level: "Advanced",
    thumbnailAccent: "from-fuchsia-600 to-slate-900",
    whatYouWillLearn: [
      "Screening vs deep diligence",
      "Market and product evaluation lenses",
      "Team and execution assessment",
    ],
    sections: [
      section("evaluation-lenses", "Section 1: Evaluation Lenses", [
        lesson(
          "screening-vs-diligence",
          "Screening vs deep diligence",
          14,
          "Screening filters for fit and credibility; diligence tests evidence. Prepare materials for both phases.",
        ),
        lesson(
          "market-and-product",
          "Market and product evaluation",
          13,
          "Investors test market size claims, differentiation, and product velocity. Evidence beats adjectives.",
        ),
        lesson(
          "team-execution",
          "Team and execution assessment",
          12,
          "Prior relevant wins, hiring velocity, and milestone delivery inform execution risk scoring.",
        ),
      ]),
    ],
  },
  {
    slug: "capital-strategy-foundations",
    title: "Capital Strategy Foundations",
    description: "Multi-year capital planning and vehicle awareness for founders.",
    longDescription:
      "Educational course on capital strategy framing — not securities, tax, or legal advice.",
    instructor: "CapitalOS Faculty",
    category: "Capital Strategy",
    level: "Advanced",
    thumbnailAccent: "from-cyan-600 to-slate-900",
    whatYouWillLearn: [
      "Capital roadmap thinking",
      "Instrument awareness at a high level",
      "Structured capital overview",
    ],
    sections: [
      section("strategy-core", "Section 1: Strategy Core", [
        lesson(
          "capital-roadmap",
          "Multi-year capital roadmap",
          15,
          "Map milestones to capital needs across 18–36 months. Investors prefer founders who understand dilution and timing tradeoffs conceptually.",
        ),
        lesson(
          "vehicle-overview",
          "Vehicles and structured capital overview",
          12,
          "High-level awareness of SAFEs, priced rounds, and structured vehicles — always engage qualified counsel for transactions.",
        ),
      ]),
    ],
  },
];

export function getCourseBySlug(slug: string) {
  return FOUNDER_COURSES.find((c) => c.slug === slug) ?? null;
}

export function listCourseCategories() {
  return [...new Set(FOUNDER_COURSES.map((c) => c.category))].sort();
}

export function flattenCourseLessons(course: Course) {
  return course.sections.flatMap((s) => s.lessons.map((l) => ({ section: s, lesson: l })));
}

export function findCourseLesson(course: Course, lessonSlug: string) {
  for (const sec of course.sections) {
    const lesson = sec.lessons.find((l) => l.slug === lessonSlug);
    if (lesson) return { section: sec, lesson };
  }
  return null;
}

export function courseLessonCount(course: Course) {
  return flattenCourseLessons(course).length;
}

export function courseDurationMinutes(course: Course) {
  return flattenCourseLessons(course).reduce((sum, { lesson }) => sum + lesson.durationMinutes, 0);
}

export function formatCourseDuration(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}
