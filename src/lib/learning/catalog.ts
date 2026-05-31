import type { LearningReadinessStage } from "@/lib/learning/types";

export type LearningProgramDefinition = {
  slug: string;
  title: string;
  description: string;
  readinessFocus: string;
  stage: LearningReadinessStage;
  moduleSlugs: string[];
};

/** Static program catalog — DB learning_programs mirrors this for admin-ready expansion. */
export const LEARNING_PROGRAM_CATALOG: LearningProgramDefinition[] = [
  {
    slug: "investor-readiness-foundations",
    title: "Investor Readiness Foundations",
    description: "Profile, narrative, storytelling, and pitch materials for institutional first-pass screening.",
    readinessFocus: "Foundation readiness",
    stage: "foundation",
    moduleSlugs: [
      "investor-ready-company-profiles",
      "writing-strong-company-descriptions",
      "startup-storytelling",
      "pitch-deck-fundamentals",
    ],
  },
  {
    slug: "data-room-readiness",
    title: "Data Room Readiness",
    description: "Document room completeness, diligence workflows, and disclosure discipline.",
    readinessFocus: "Data room & diligence preparation",
    stage: "readiness",
    moduleSlugs: ["investor-materials", "due-diligence-preparation", "compliance-readiness"],
  },
  {
    slug: "financial-readiness",
    title: "Financial Readiness",
    description: "Projections, unit economics, and raise planning investors can diligence.",
    readinessFocus: "Financial investor preparation",
    stage: "readiness",
    moduleSlugs: ["financial-projections", "capital-raise-strategy"],
  },
  {
    slug: "governance-readiness",
    title: "Governance Readiness",
    description: "Corporate hygiene, board readiness, and governance artifacts.",
    readinessFocus: "Governance milestone",
    stage: "readiness",
    moduleSlugs: ["governance-basics", "board-readiness"],
  },
  {
    slug: "fundraising-operations",
    title: "Fundraising Operations",
    description: "Outreach, follow-up, negotiation context, and structured capital vehicles.",
    readinessFocus: "Capital operations",
    stage: "capital",
    moduleSlugs: [
      "investor-outreach",
      "follow-up-strategy",
      "negotiation-fundamentals",
      "spvs-structured-capital",
    ],
  },
  {
    slug: "investor-communication",
    title: "Investor Communication",
    description: "Investor updates, meeting preparation, and institutional relationship signals.",
    readinessFocus: "Investor engagement",
    stage: "engagement",
    moduleSlugs: ["investor-updates", "meeting-preparation", "investor-psychology"],
  },
  {
    slug: "institutional-reporting",
    title: "Institutional Reporting",
    description: "Reporting cadence and deep diligence operating rhythm.",
    readinessFocus: "Institutional reporting",
    stage: "institutional",
    moduleSlugs: ["reporting-systems", "institutional-diligence"],
  },
  {
    slug: "capital-strategy",
    title: "Capital Strategy",
    description: "Multi-year capital roadmap and platform readiness tier progression.",
    readinessFocus: "Long-term capital strategy",
    stage: "institutional",
    moduleSlugs: ["long-term-capital-strategy"],
  },
];

export function getProgramBySlug(slug: string) {
  return LEARNING_PROGRAM_CATALOG.find((p) => p.slug === slug) ?? null;
}

export function getProgramForModuleSlug(moduleSlug: string) {
  return LEARNING_PROGRAM_CATALOG.find((p) => p.moduleSlugs.includes(moduleSlug)) ?? LEARNING_PROGRAM_CATALOG[0];
}

export type CapitalOsReadinessTier = {
  tier: 1 | 2 | 3 | 4;
  label: string;
  description: string;
};

export function computeCapitalOsReadinessTier(input: {
  overallLearningPercent: number;
  readinessScore: number | null;
  onboardingPercent: number;
  modulesCompleted: number;
}): CapitalOsReadinessTier {
  if (
    input.overallLearningPercent >= 60 &&
    (input.readinessScore ?? 0) >= 70 &&
    input.modulesCompleted >= 8
  ) {
    return {
      tier: 4,
      label: "Tier IV — Institutional track",
      description: "Strong platform readiness progress across learning, diligence, and materials.",
    };
  }
  if (input.overallLearningPercent >= 40 && (input.readinessScore ?? 0) >= 55) {
    return {
      tier: 3,
      label: "Tier III — Engagement ready",
      description: "Suitable for structured investor outreach preparation on the platform.",
    };
  }
  if (input.onboardingPercent >= 70 || input.modulesCompleted >= 3) {
    return {
      tier: 2,
      label: "Tier II — Readiness building",
      description: "Core gaps are being addressed — continue recommended lessons.",
    };
  }
  return {
    tier: 1,
    label: "Tier I — Foundation",
    description: "Establish profile, documents, and foundational learning milestones.",
  };
}
