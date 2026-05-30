import { listCompanyDocuments } from "@/lib/data/documents";
import { computeReadinessScore, getLatestDiligenceReport } from "@/lib/data/founder-readiness";
import { buildRemediationLearningLinks, buildLearningRecommendations } from "@/lib/learning/recommendations";
import { computeReadinessMilestones, getCurrentMilestone, getNextMilestone } from "@/lib/learning/milestones";
import {
  computeOverallLearningPercent,
  listLearningProgressForCompany,
  listPublishedLearningModules,
  progressByModuleId,
} from "@/lib/learning/progress";
import { loadFounderRemediationPlan } from "@/lib/remediation/load-founder-remediation";
import { computeFounderOnboardingProgress } from "@/lib/onboarding/progress";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/supabase/types";
import type { LearningModuleRecord, LearningProgressRecord } from "@/lib/learning/types";

export type FounderLearningModuleView = LearningModuleRecord & {
  progress: LearningProgressRecord | null;
};

export async function loadFounderLearningWorkspace(profile: Profile) {
  const company = await ensureFounderCompanyForUser(profile);
  const modules = await listPublishedLearningModules();

  if (!company) {
    return {
      company: null,
      modules: [] as FounderLearningModuleView[],
      recommendations: [],
      milestones: computeReadinessMilestones({
        company: null,
        documents: [],
        onboardingPercent: 0,
        readinessScore: null,
        hasDiligenceReport: false,
        remediationActive: 0,
        remediationHighPriorityOpen: 0,
        learningPercentComplete: 0,
        learningModulesCompleted: 0,
      }),
      currentMilestone: null,
      nextMilestone: getNextMilestone(
        computeReadinessMilestones({
          company: null,
          documents: [],
          onboardingPercent: 0,
          readinessScore: null,
          hasDiligenceReport: false,
          remediationActive: 0,
          remediationHighPriorityOpen: 0,
          learningPercentComplete: 0,
          learningModulesCompleted: 0,
        }),
      ),
      overallPercent: 0,
      continueModules: [] as FounderLearningModuleView[],
      recommendedModules: [] as FounderLearningModuleView[],
      remediationLearningLinks: {},
    };
  }

  const supabase = await createServerSupabaseClient();
  const remediationPlan = await loadFounderRemediationPlan(profile);
  const [{ data: documents }, { data: diligenceReport }, progressRows] = await Promise.all([
    listCompanyDocuments(supabase, company.id),
    getLatestDiligenceReport(supabase, company.id),
    listLearningProgressForCompany(profile.id, company.id),
  ]);

  const onboarding = computeFounderOnboardingProgress({
    company,
    documents: documents ?? [],
    diligenceReportExists: Boolean(diligenceReport),
    storedStepState: company.onboarding_step_state,
  });

  const progressMap = progressByModuleId(progressRows);
  const moduleViews: FounderLearningModuleView[] = modules.map((module) => ({
    ...module,
    progress: progressMap.get(module.id) ?? null,
  }));

  const uploadedTypes = (documents ?? []).flatMap((document) =>
    document.document_type ? [document.document_type] : [],
  );
  const readinessScore = diligenceReport?.readiness_score ?? computeReadinessScore(uploadedTypes);
  const activeTasks = remediationPlan.tasks.filter(
    (task) => task.status === "open" || task.status === "in_progress",
  );
  const highPriorityOpen = activeTasks.filter((task) => task.priority === "high").length;
  const progressCompleted = progressRows.filter((row) => row.status === "completed").length;
  const overallPercent = computeOverallLearningPercent(modules, progressRows);

  const recommendations = buildLearningRecommendations({
    modules,
    remediationSourceKeys: activeTasks.map((task) => ({
      source_key: task.source_key,
      category: task.category,
      priority: task.priority,
    })),
    onboardingPercent: onboarding.percent,
    readinessScore,
    hasDiligenceReport: Boolean(diligenceReport),
    hasPitchDeck: uploadedTypes.some((type) => type.toUpperCase() === "PITCH_DECK"),
    reviewStatus: company.review_status ? String(company.review_status) : null,
  });

  const milestones = computeReadinessMilestones({
    company,
    documents: documents ?? [],
    onboardingPercent: onboarding.percent,
    readinessScore,
    hasDiligenceReport: Boolean(diligenceReport),
    remediationActive: activeTasks.length,
    remediationHighPriorityOpen: highPriorityOpen,
    learningPercentComplete: overallPercent,
    learningModulesCompleted: progressCompleted,
  });

  const recommendedIds = new Set(recommendations.map((item) => item.moduleId));
  const continueModules = moduleViews
    .filter((module) => module.progress?.status === "in_progress")
    .sort((a, b) => {
      const aTime = a.progress?.last_viewed_at ? new Date(a.progress.last_viewed_at).getTime() : 0;
      const bTime = b.progress?.last_viewed_at ? new Date(b.progress.last_viewed_at).getTime() : 0;
      return bTime - aTime;
    });

  const recommendedModules = moduleViews.filter((module) => recommendedIds.has(module.id));

  return {
    company,
    modules: moduleViews,
    recommendations,
    recommendedModules,
    milestones,
    currentMilestone: getCurrentMilestone(milestones),
    nextMilestone: getNextMilestone(milestones),
    overallPercent,
    continueModules,
    remediationLearningLinks: buildRemediationLearningLinks(
      modules,
      remediationPlan.tasks.map((task) => ({ source_key: task.source_key, category: task.category })),
    ),
  };
}
