import { computeReadinessScore } from "@/lib/data/founder-readiness";
import { computeFounderOnboardingProgress } from "@/lib/onboarding/progress";
import {
  listLearningProgressForCompany,
  listPublishedLearningModules,
} from "@/lib/learning/progress";
import type { AICoachRecommendation, LearningModuleRecord, LearningRecommendation } from "@/lib/learning/types";
import { READINESS_SCORE_THRESHOLD } from "@/lib/remediation/rules";
import { listRemediationTasksForCompany } from "@/lib/remediation/tasks";
import type { RemediationCategory } from "@/lib/remediation/types";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { Company, DocumentRecord } from "@/lib/supabase/types";

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

const CATEGORY_GAP_LABEL: Record<RemediationCategory, string> = {
  company_profile: "company profile",
  documents: "document room",
  financials: "financial projections",
  governance: "cap table and governance",
  market: "market positioning",
  investor_materials: "investor materials",
  readiness: "readiness score",
  compliance: "compliance readiness",
};

const PRIORITY_SCORE = { high: 30, medium: 20, low: 10 } as const;

function formatCoachGapReason(category: RemediationCategory, moduleTitle: string, taskTitle?: string) {
  const gap = CATEGORY_GAP_LABEL[category];
  if (taskTitle) {
    return `${taskTitle} — ${moduleTitle} addresses your ${gap} directly.`;
  }
  return `Your ${gap} needs improvement — ${moduleTitle} addresses it directly.`;
}

export async function getAICoachRecommendations(
  founderId: string,
  companyId: string,
): Promise<AICoachRecommendation[]> {
  const admin = createServiceRoleClient();
  const [{ data: company }, { data: documents }, { data: diligenceReport }, modules, progressRows, tasks] =
    await Promise.all([
      admin.from("companies").select("*").eq("id", companyId).maybeSingle(),
      admin.from("documents").select("*").eq("company_id", companyId),
      admin
        .from("diligence_reports")
        .select("readiness_score, missing_documents, risk_flags, recommendations")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      listPublishedLearningModules(),
      listLearningProgressForCompany(founderId, companyId),
      listRemediationTasksForCompany(companyId),
    ]);

  if (!company) {
    return [];
  }

  const docRows = (documents ?? []) as DocumentRecord[];
  const uploadedTypes = docRows.flatMap((document) => (document.document_type ? [document.document_type] : []));
  const onboarding = computeFounderOnboardingProgress({
    company: company as Company,
    documents: docRows,
    diligenceReportExists: Boolean(diligenceReport),
    storedStepState: (company as Company).onboarding_step_state,
  });
  const readinessScore = diligenceReport?.readiness_score ?? computeReadinessScore(uploadedTypes);
  const completedModuleIds = new Set(
    progressRows.filter((row) => row.status === "completed").map((row) => row.module_id),
  );
  const activeTasks = tasks.filter((task) => task.status === "open" || task.status === "in_progress");

  const candidateMap = new Map<string, { module: LearningModuleRecord; score: number; reason: string }>();

  function upsert(module: LearningModuleRecord, score: number, reason: string) {
    if (completedModuleIds.has(module.id)) return;
    const existing = candidateMap.get(module.id);
    if (!existing || score > existing.score) {
      candidateMap.set(module.id, { module, score, reason });
    }
  }

  for (const task of activeTasks) {
    const taskScore = PRIORITY_SCORE[task.priority] ?? 10;
    const categoryMatches = modules.filter(
      (module) => module.related_remediation_category === task.category,
    );
    for (const module of categoryMatches) {
      upsert(module, taskScore, formatCoachGapReason(task.category, module.title, task.title));
    }

    const slug = resolveModuleSlugForRemediation(task.source_key, task.category);
    if (slug) {
      const module = modules.find((item) => item.slug === slug);
      if (module) {
        upsert(
          module,
          taskScore + 5,
          formatCoachGapReason(task.category, module.title, task.title),
        );
      }
    }
  }

  if (readinessScore < READINESS_SCORE_THRESHOLD) {
    for (const module of modules.filter((item) => item.related_remediation_category === "readiness")) {
      upsert(
        module,
        25,
        `Your readiness score is ${readinessScore}% (below ${READINESS_SCORE_THRESHOLD}) — ${module.title} helps close institutional gaps.`,
      );
    }
  }

  if (onboarding.percent < 100) {
    for (const module of modules.filter((item) => item.related_remediation_category === "company_profile")) {
      upsert(
        module,
        22,
        `Onboarding is ${onboarding.percent}% complete — ${module.title} strengthens your investor-ready profile.`,
      );
    }
  }

  return [...candidateMap.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((candidate) => ({
      moduleId: candidate.module.id,
      slug: candidate.module.slug,
      title: candidate.module.title,
      reason: candidate.reason,
    }));
}
