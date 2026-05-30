import { listCompanyDocuments } from "@/lib/data/documents";
import { getLatestDiligenceReport } from "@/lib/data/founder-readiness";
import { computeFounderOnboardingProgress } from "@/lib/onboarding/progress";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { buildRemediationLearningLinks } from "@/lib/learning/recommendations";
import { listPublishedLearningModules } from "@/lib/learning/progress";
import { summarizeRemediationTasks, syncFounderRemediationTasks } from "@/lib/remediation/tasks";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/supabase/types";

export async function loadFounderRemediationPlan(profile: Profile) {
  const company = await ensureFounderCompanyForUser(profile);

  if (!company) {
    return { company: null, tasks: [], summary: summarizeRemediationTasks([]), learningLinks: {} };
  }

  const supabase = await createServerSupabaseClient();
  const { data: documents } = await listCompanyDocuments(supabase, company.id);
  const { data: diligenceReport } = await getLatestDiligenceReport(supabase, company.id);

  const onboarding = computeFounderOnboardingProgress({
    company,
    documents: documents ?? [],
    diligenceReportExists: Boolean(diligenceReport),
    storedStepState: company.onboarding_step_state,
  });

  const tasks = await syncFounderRemediationTasks({
    company,
    founderId: profile.id,
    documents: documents ?? [],
    diligenceReport: diligenceReport ?? null,
    onboardingPercent: onboarding.percent,
  });

  const modules = await listPublishedLearningModules();
  const learningLinks = buildRemediationLearningLinks(
    modules,
    tasks.map((task) => ({ source_key: task.source_key, category: task.category })),
  );

  return {
    company,
    tasks,
    summary: summarizeRemediationTasks(tasks),
    onboardingPercent: onboarding.percent,
    learningLinks,
  };
}
