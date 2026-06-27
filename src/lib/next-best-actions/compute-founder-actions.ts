import type { SupabaseClient } from "@supabase/supabase-js";
import { buildActionId, createNextBestAction } from "@/lib/next-best-actions/action-catalog";
import type { NextBestAction } from "@/lib/next-best-actions/types";
import { listCompanyDocuments } from "@/lib/data/documents";
import { computeReadinessScore, getLatestDiligenceReport } from "@/lib/data/founder-readiness";
import { computeDataRoomState, type DataRoomState } from "@/lib/data-room/completeness";
import { listFounderCompanyUpdates } from "@/lib/company-updates/company-updates";
import { listFounderInvestorContacts } from "@/lib/founder-crm/contacts";
import { evaluateFounderOutreachReadiness } from "@/lib/founder-crm/outreach-readiness";
import { listFounderInvestorActivity } from "@/lib/data/investor-interests";
import { FOUNDER_COURSES } from "@/lib/learning/courses";
import { computeCoursePercentComplete } from "@/lib/learning/course-progress";
import { computeReadinessMilestones, getNextMilestone } from "@/lib/learning/milestones";
import { listLessonProgressForCompany } from "@/lib/learning/lesson-progress";
import { computeFounderOnboardingProgress } from "@/lib/onboarding/progress";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { READINESS_SCORE_THRESHOLD } from "@/lib/remediation/rules";
import { loadFounderRemediationPlan } from "@/lib/remediation/load-founder-remediation";
import { countUnreadNotifications } from "@/lib/notifications/notifications";
import type { Profile, Company, Database } from "@/lib/supabase/types";

export type FounderNbaContext = {
  company: Company | null;
  onboardingPercent: number;
  onboardingComplete: boolean;
  currentOnboardingStep: string;
  pitchDeckUploaded: boolean;
  dataRoom: DataRoomState;
  readinessScore: number | null;
  remediationHighOpen: number;
  remediationActive: number;
  learningPercent: number;
  learningModulesCompleted: number;
  nextMilestonePending: string | null;
  contactCount: number;
  publishedUpdateCount: number;
  outreachBlocked: boolean;
  outreachBlockers: string[];
  investorInterestCount: number;
  introRequestCount: number;
  unreadNotifications: number;
  spvAttention: Array<{ id: string; name: string; status: string; readiness: string | null }>;
};

export async function loadFounderNbaContext(
  profile: Profile,
  supabase: SupabaseClient<Database>,
): Promise<FounderNbaContext> {
  const company = await ensureFounderCompanyForUser(profile);
  const empty: FounderNbaContext = {
    company: null,
    onboardingPercent: 0,
    onboardingComplete: false,
    currentOnboardingStep: "company_profile",
    pitchDeckUploaded: false,
    dataRoom: computeDataRoomState([]),
    readinessScore: null,
    remediationHighOpen: 0,
    remediationActive: 0,
    learningPercent: 0,
    learningModulesCompleted: 0,
    nextMilestonePending: "Complete company onboarding",
    contactCount: 0,
    publishedUpdateCount: 0,
    outreachBlocked: true,
    outreachBlockers: ["No company linked"],
    investorInterestCount: 0,
    introRequestCount: 0,
    unreadNotifications: await countUnreadNotifications(profile.id).catch(() => 0),
    spvAttention: [],
  };

  if (!company) {
    return empty;
  }

  const [{ data: documents }, { data: diligenceReport }, remediation, progressRows, contacts, updates, investorActivity, outreachReadiness, spvRows, unreadNotifications] =
    await Promise.all([
      listCompanyDocuments(supabase, company.id),
      getLatestDiligenceReport(supabase, company.id),
      loadFounderRemediationPlan(profile),
      listLessonProgressForCompany(profile.id, company.id),
      listFounderInvestorContacts(supabase, profile.id, company.id).then((result) =>
        "data" in result ? result : { data: [] as { id: string }[] },
      ),
      listFounderCompanyUpdates(supabase, company.id).catch(() => ({ data: [] as { published_at: string | null }[] })),
      listFounderInvestorActivity(supabase, company.id),
      evaluateFounderOutreachReadiness(company, profile.id),
      supabase
        .from("spv_opportunities")
        .select("id, name, status, operational_readiness_status")
        .eq("company_id", company.id)
        .in("status", ["draft", "under_review", "open"]),
      countUnreadNotifications(profile.id).catch(() => 0),
    ]);

  const docs = documents ?? [];
  const onboarding = computeFounderOnboardingProgress({
    company,
    documents: docs,
    diligenceReportExists: Boolean(diligenceReport),
    storedStepState: company.onboarding_step_state,
  });

  const uploadedTypeCodes = docs.flatMap((doc) => (doc.document_type ? [doc.document_type] : []));
  const readinessScore = diligenceReport?.readiness_score ?? computeReadinessScore(uploadedTypeCodes);

  const learningPercent =
    FOUNDER_COURSES.length > 0
      ? Math.round(
          FOUNDER_COURSES.reduce((sum, course) => sum + computeCoursePercentComplete(course, progressRows), 0) /
            FOUNDER_COURSES.length,
        )
      : 0;

  const learningModulesCompleted = progressRows.filter((row) => row.status === "completed").length;

  const milestones = computeReadinessMilestones({
    company,
    documents: docs,
    onboardingPercent: onboarding.percent,
    readinessScore,
    hasDiligenceReport: Boolean(diligenceReport),
    remediationActive: remediation.summary.active,
    remediationHighPriorityOpen: remediation.tasks.filter((t) => t.priority === "high" && !["completed", "dismissed"].includes(t.status)).length,
    learningPercentComplete: learningPercent,
    learningModulesCompleted,
  });
  const nextMilestone = getNextMilestone(milestones);

  const highOpen = remediation.tasks.filter(
    (t) => t.priority === "high" && ["open", "in_progress"].includes(t.status),
  ).length;

  const publishedUpdates = (updates.data ?? []).filter((row) => row.published_at);

  const spvAttention = (spvRows.data ?? [])
    .filter((row) => {
      const readiness = row.operational_readiness_status;
      return readiness && !["ready_for_legal_docs", "closed"].includes(readiness);
    })
    .map((row) => ({
      id: row.id,
      name: row.name,
      status: row.status,
      readiness: row.operational_readiness_status,
    }));

  return {
    company,
    onboardingPercent: onboarding.percent,
    onboardingComplete: onboarding.isComplete,
    currentOnboardingStep: onboarding.currentStep,
    pitchDeckUploaded: onboarding.pitchDeckUploaded,
    dataRoom: computeDataRoomState(docs),
    readinessScore,
    remediationHighOpen: highOpen,
    remediationActive: remediation.summary.active,
    learningPercent,
    learningModulesCompleted,
    nextMilestonePending: nextMilestone?.criteriaPending[0] ?? null,
    contactCount: contacts.data?.length ?? 0,
    publishedUpdateCount: publishedUpdates.length,
    outreachBlocked: !outreachReadiness.allowed,
    outreachBlockers: outreachReadiness.requirements.filter((r) => !r.met).map((r) => r.label),
    investorInterestCount: investorActivity?.interests.length ?? 0,
    introRequestCount: investorActivity?.introRequests.length ?? 0,
    unreadNotifications,
    spvAttention,
  };
}

export function computeFounderActions(ctx: FounderNbaContext, entityFilter?: { entityType?: string; entityId?: string }): NextBestAction[] {
  const actions: NextBestAction[] = [];
  const companyId = ctx.company?.id;

  if (entityFilter?.entityType === "company" && entityFilter.entityId && companyId && entityFilter.entityId !== companyId) {
    return [];
  }

  if (!ctx.company) {
    actions.push(
      createNextBestAction({
        id: buildActionId(["founder", "onboarding", "no_company"]),
        role: "founder",
        title: "Complete onboarding",
        description: "Link your company profile to unlock documents, readiness, and investor workflows.",
        priority: "critical",
        category: "onboarding",
        entityType: "founder",
        entityId: undefined,
        href: "/founder/onboarding",
        sourceModule: "onboarding",
        reason: "No company profile is linked to your account.",
        createdFrom: "founder_nba",
      }),
    );
    return actions;
  }

  const company = ctx.company;

  if (!ctx.onboardingComplete) {
    actions.push(
      createNextBestAction({
        id: buildActionId(["founder", "onboarding", company.id]),
        role: "founder",
        title: "Complete onboarding",
        description: `You are ${ctx.onboardingPercent}% through onboarding. Current step: ${ctx.currentOnboardingStep.replaceAll("_", " ")}.`,
        priority: ctx.onboardingPercent < 40 ? "critical" : "high",
        category: "onboarding",
        entityType: "company",
        entityId: company.id,
        companyId: company.id,
        href: "/founder/onboarding",
        sourceModule: "onboarding",
        reason: "Onboarding unlocks diligence, remediation, and marketplace review.",
        blockers: ctx.onboardingPercent < 100 ? ["Incomplete onboarding steps"] : [],
        createdFrom: "founder_nba",
        urgencyAt: new Date().toISOString(),
      }),
    );
  }

  // Data room — the #1 priority. Drive founders to complete diligence docs.
  const dr = ctx.dataRoom;
  if (!dr.coreComplete) {
    const missingNames = dr.coreMissing.map((i) => i.label).join(", ");
    const next = dr.nextItem;
    actions.push(
      createNextBestAction({
        id: buildActionId(["founder", "data_room_core", company.id]),
        role: "founder",
        title: "Complete your investor-access documents",
        description: `${dr.coreCompleted}/${dr.coreTotal} essentials done. Missing: ${missingNames}. These unlock investor visibility and introductions.`,
        priority: "critical",
        category: "documents",
        entityType: "company",
        entityId: company.id,
        companyId: company.id,
        href: next?.href ?? "/founder/readiness/data-room",
        sourceModule: "documents",
        reason: "Required diligence documents are missing — investors cannot be reached until these are in.",
        blockers: dr.coreMissing.map((i) => `Missing: ${i.label}`),
        createdFrom: "founder_nba",
        urgencyAt: new Date().toISOString(),
      }),
    );
  } else if (!dr.fullComplete) {
    actions.push(
      createNextBestAction({
        id: buildActionId(["founder", "data_room_full", company.id]),
        role: "founder",
        title: "Finish your data room",
        description: `Your data room is ${dr.percent}% complete — ${dr.missingCount} document${dr.missingCount === 1 ? "" : "s"} left for a full diligence package.`,
        priority: "high",
        category: "documents",
        entityType: "company",
        entityId: company.id,
        companyId: company.id,
        href: "/founder/readiness/data-room",
        sourceModule: "documents",
        reason: "A complete data room speeds diligence and strengthens investor confidence.",
        createdFrom: "founder_nba",
      }),
    );
  }

  if (ctx.remediationHighOpen > 0) {
    actions.push(
      createNextBestAction({
        id: buildActionId(["founder", "remediation_high", company.id]),
        role: "founder",
        title: "Resolve high-priority remediation",
        description: `${ctx.remediationHighOpen} high-priority remediation ${ctx.remediationHighOpen === 1 ? "task" : "tasks"} need attention.`,
        priority: "high",
        category: "readiness",
        entityType: "company",
        entityId: company.id,
        companyId: company.id,
        href: "/founder/readiness",
        sourceModule: "remediation",
        reason: "High-priority gaps block stronger investor readiness signals.",
        createdFrom: "founder_nba",
      }),
    );
  } else if (ctx.remediationActive > 0) {
    actions.push(
      createNextBestAction({
        id: buildActionId(["founder", "remediation", company.id]),
        role: "founder",
        title: "Review remediation tasks",
        description: `${ctx.remediationActive} open remediation ${ctx.remediationActive === 1 ? "task" : "tasks"} remain on your action plan.`,
        priority: "medium",
        category: "readiness",
        entityType: "company",
        entityId: company.id,
        companyId: company.id,
        href: "/founder/readiness",
        sourceModule: "remediation",
        reason: "Closing remediation tasks improves readiness score and marketplace posture.",
        createdFrom: "founder_nba",
      }),
    );
  }

  if (ctx.readinessScore != null && ctx.readinessScore < READINESS_SCORE_THRESHOLD) {
    actions.push(
      createNextBestAction({
        id: buildActionId(["founder", "readiness_score", company.id]),
        role: "founder",
        title: "Improve readiness score",
        description: `Your readiness score is ${ctx.readinessScore}. Target ${READINESS_SCORE_THRESHOLD}+ for stronger investor confidence.`,
        priority: "high",
        category: "readiness",
        entityType: "company",
        entityId: company.id,
        companyId: company.id,
        href: "/founder/readiness",
        sourceModule: "diligence",
        reason: "Readiness score is below the institutional threshold.",
        createdFrom: "founder_nba",
      }),
    );
  }

  if (ctx.nextMilestonePending && ctx.learningModulesCompleted < 2) {
    actions.push(
      createNextBestAction({
        id: buildActionId(["founder", "learning_milestone", company.id]),
        role: "founder",
        title: "Complete learning modules",
        description: ctx.nextMilestonePending,
        priority: "medium",
        category: "readiness",
        entityType: "company",
        entityId: company.id,
        companyId: company.id,
        href: "/founder/learning",
        sourceModule: "learning",
        reason: "Learning milestones support investor-ready positioning.",
        createdFrom: "founder_nba",
      }),
    );
  }

  if (ctx.contactCount === 0) {
    actions.push(
      createNextBestAction({
        id: buildActionId(["founder", "crm_contacts", company.id]),
        role: "founder",
        title: "Add investor contacts",
        description: "Import or add investors to your private CRM before launching outreach.",
        priority: "low",
        category: "outreach",
        entityType: "company",
        entityId: company.id,
        companyId: company.id,
        href: "/founder/investors",
        sourceModule: "founder_crm",
        reason: "No investor contacts are on file for this company.",
        createdFrom: "founder_nba",
      }),
    );
  }

  if (ctx.outreachBlocked && ctx.onboardingPercent >= 40) {
    actions.push(
      createNextBestAction({
        id: buildActionId(["founder", "outreach_blocked", company.id]),
        role: "founder",
        title: "Unlock outreach readiness",
        description: "Complete readiness requirements before queuing investor outreach campaigns.",
        priority: "high",
        category: "outreach",
        entityType: "company",
        entityId: company.id,
        companyId: company.id,
        href: "/founder/readiness",
        sourceModule: "outreach",
        reason: "Outreach is blocked until readiness gates are met.",
        blockers: ctx.outreachBlockers.slice(0, 5),
        createdFrom: "founder_nba",
      }),
    );
  }

  if (ctx.publishedUpdateCount === 0 && ctx.onboardingPercent >= 60) {
    actions.push(
      createNextBestAction({
        id: buildActionId(["founder", "company_update", company.id]),
        role: "founder",
        title: "Publish a company update",
        description: "Share traction or fundraising progress with interested investors.",
        priority: "medium",
        category: "investor_engagement",
        entityType: "company",
        entityId: company.id,
        companyId: company.id,
        href: "/founder/capital-raise",
        sourceModule: "company_updates",
        reason: "No published company updates yet.",
        createdFrom: "founder_nba",
      }),
    );
  }

  for (const spv of ctx.spvAttention.slice(0, 2)) {
    if (entityFilter?.entityType === "spv" && entityFilter.entityId && entityFilter.entityId !== spv.id) {
      continue;
    }
    actions.push(
      createNextBestAction({
        id: buildActionId(["founder", "spv", spv.id]),
        role: "founder",
        title: `Review SPV: ${spv.name}`,
        description: `SPV status is ${spv.status.replaceAll("_", " ")} with operational readiness ${spv.readiness?.replaceAll("_", " ") ?? "pending"}.`,
        priority: "medium",
        category: "spv",
        entityType: "spv",
        entityId: spv.id,
        companyId: company.id,
        spvId: spv.id,
        href: "/founder/capital-raise",
        sourceModule: "spv",
        reason: "An active SPV needs founder awareness.",
        createdFrom: "founder_nba",
      }),
    );
  }

  if (ctx.unreadNotifications > 0 && (ctx.investorInterestCount > 0 || ctx.introRequestCount > 0)) {
    actions.push(
      createNextBestAction({
        id: buildActionId(["founder", "notifications", company.id]),
        role: "founder",
        title: "Review investor activity",
        description: `${ctx.unreadNotifications} unread notification${ctx.unreadNotifications === 1 ? "" : "s"} — ${ctx.investorInterestCount} interest, ${ctx.introRequestCount} intro requests.`,
        priority: "medium",
        category: "investor_engagement",
        entityType: "company",
        entityId: company.id,
        companyId: company.id,
        href: "/founder/messages",
        sourceModule: "notifications",
        reason: "Investor signals may need a timely response.",
        createdFrom: "founder_nba",
      }),
    );
  }

  return actions;
}
