import type { RemediationCategory } from "@/lib/remediation/types";
import type { LearningModuleRecord, LearningRecommendation } from "@/lib/learning/types";

const SOURCE_KEY_MODULE_SLUG: Record<string, string> = {
  "profile:company_description": "writing-strong-company-descriptions",
  "profile:industry": "investor-ready-company-profiles",
  "profile:founder_goals": "investor-ready-company-profiles",
  "profile:website": "investor-materials",
  "financials:target_raise": "capital-raise-strategy",
  "financials:funding_stage": "financial-projections",
  "financials:use_of_funds": "capital-raise-strategy",
  "documents:missing_pitch_deck": "pitch-deck-fundamentals",
  "documents:missing_financial_statements": "financial-projections",
  "readiness:no_diligence_report": "due-diligence-preparation",
  "readiness:score_below_threshold": "due-diligence-preparation",
  "readiness:incomplete_onboarding": "investor-ready-company-profiles",
  "compliance:not_submitted_review": "compliance-readiness",
  "compliance:changes_requested": "compliance-readiness",
  "materials:no_investor_package": "investor-materials",
};

const CATEGORY_MODULE_SLUG: Record<RemediationCategory, string> = {
  company_profile: "investor-ready-company-profiles",
  documents: "pitch-deck-fundamentals",
  financials: "financial-projections",
  governance: "governance-basics",
  market: "startup-storytelling",
  investor_materials: "investor-materials",
  readiness: "due-diligence-preparation",
  compliance: "compliance-readiness",
};

export function resolveModuleSlugForRemediation(sourceKey: string, category: RemediationCategory) {
  if (SOURCE_KEY_MODULE_SLUG[sourceKey]) {
    return SOURCE_KEY_MODULE_SLUG[sourceKey];
  }

  if (sourceKey.startsWith("documents:missing_")) {
    if (sourceKey.includes("pitch")) return "pitch-deck-fundamentals";
    if (sourceKey.includes("financial")) return "financial-projections";
    if (sourceKey.includes("legal") || sourceKey.includes("corporate")) return "governance-basics";
    return "investor-materials";
  }

  if (sourceKey.startsWith("diligence:missing_")) {
    return "due-diligence-preparation";
  }

  if (sourceKey.startsWith("diligence:risk_")) {
    return "governance-basics";
  }

  return CATEGORY_MODULE_SLUG[category] ?? null;
}

export function buildLearningRecommendations(input: {
  modules: LearningModuleRecord[];
  remediationSourceKeys: Array<{ source_key: string; category: RemediationCategory; priority: string }>;
  onboardingPercent: number;
  readinessScore: number | null;
  hasDiligenceReport: boolean;
  hasPitchDeck: boolean;
  reviewStatus: string | null;
}): LearningRecommendation[] {
  const moduleBySlug = new Map(input.modules.map((learningModule) => [learningModule.slug, learningModule]));
  const recommendations: LearningRecommendation[] = [];
  const seen = new Set<string>();

  function add(slug: string, reason: string, priority: "high" | "medium" | "low") {
    if (seen.has(slug)) return;
    const learningModule = moduleBySlug.get(slug);
    if (!learningModule) return;
    seen.add(slug);
    recommendations.push({
      moduleId: learningModule.id,
      slug: learningModule.slug,
      title: learningModule.title,
      reason,
      priority,
      relatedRemediationCategory: learningModule.related_remediation_category,
    });
  }

  for (const task of input.remediationSourceKeys) {
    const slug = resolveModuleSlugForRemediation(task.source_key, task.category);
    if (!slug) continue;
    const priority = task.priority === "high" ? "high" : task.priority === "medium" ? "medium" : "low";
    add(slug, `Linked to remediation gap: ${task.source_key}`, priority);
  }

  if (input.onboardingPercent < 100) {
    add("investor-ready-company-profiles", "Onboarding is incomplete — strengthen your investor-ready profile.", "high");
  }

  if (!input.hasPitchDeck) {
    add("pitch-deck-fundamentals", "Pitch deck is missing from your document room.", "high");
  }

  if (!input.hasDiligenceReport) {
    add("due-diligence-preparation", "No AI diligence report yet — prepare materials before analysis.", "high");
  }

  if (input.readinessScore != null && input.readinessScore < 75) {
    add("due-diligence-preparation", "Readiness score is below institutional threshold (75).", "high");
  }

  if (input.reviewStatus === "changes_requested") {
    add("compliance-readiness", "Admin requested changes — review compliance and disclosure readiness.", "high");
  }

  const priorityOrder = { high: 0, medium: 1, low: 2 };
  return recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
}

export function buildRemediationLearningLinks(
  modules: LearningModuleRecord[],
  tasks: Array<{ source_key: string; category: RemediationCategory }>,
) {
  const moduleBySlug = new Map(modules.map((learningModule) => [learningModule.slug, learningModule]));
  const links: Record<string, { slug: string; title: string }> = {};

  for (const task of tasks) {
    const slug = resolveModuleSlugForRemediation(task.source_key, task.category);
    if (!slug) continue;
    const learningModule = moduleBySlug.get(slug);
    if (!learningModule) continue;
    links[task.source_key] = { slug: learningModule.slug, title: learningModule.title };
  }

  return links;
}
