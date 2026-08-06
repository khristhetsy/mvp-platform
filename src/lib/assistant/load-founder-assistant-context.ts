import type { SupabaseClient } from "@supabase/supabase-js";
import { listCompanyDocuments } from "@/lib/data/documents";
import {
  buildDocumentChecklist,
  computeReadinessScore,
  getLatestDiligenceReport,
} from "@/lib/data/founder-readiness";
import { listFounderInvestorActivity } from "@/lib/data/investor-interests";
import { FOUNDER_COURSES } from "@/lib/learning/courses";
import { computeCoursePercentComplete } from "@/lib/learning/course-progress";
import { listLessonProgressForCompany } from "@/lib/learning/lesson-progress";
import { computeFounderOnboardingProgress } from "@/lib/onboarding/progress";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { loadFounderRemediationPlan } from "@/lib/remediation/load-founder-remediation";
import type { SanitizedAssistantContext } from "@/lib/assistant/types";
import {
  inferAssistantMode,
  parseEntityFromPath,
  workspaceLabelForRole,
} from "@/lib/assistant/assistant-context";
import type { Profile, Database } from "@/lib/supabase/types";

export async function loadFounderAssistantContext(
  profile: Profile,
  supabase: SupabaseClient<Database>,
  input: {
    currentPath?: string;
    mode?: SanitizedAssistantContext["mode"];
    entityType?: string;
    entityId?: string;
  },
): Promise<SanitizedAssistantContext> {
  const company = await ensureFounderCompanyForUser(profile);
  const currentPath = input.currentPath ?? null;
  const mode = inferAssistantMode({ role: "founder", currentPath, requestedMode: input.mode });

  const highlights: string[] = [];
  const summary: SanitizedAssistantContext["summary"] = {
    companyLinked: Boolean(company),
    companyName: company?.company_name ?? null,
    onboardingPercent: 0,
    currentOnboardingStep: "company_profile",
    pitchDeckUploaded: false,
    documentsUploadedCount: 0,
    documentsRequiredCount: 0,
    documentsMissingCount: 0,
    readinessScore: null,
    remediationActiveCount: 0,
    remediationHighPriorityCount: 0,
    learningPercentComplete: 0,
    investorInterestCount: 0,
    introRequestCount: 0,
    savedDealsCount: 0,
    isPublished: false,
    reviewStatus: null,
    spvParticipationCount: 0,
    notificationsUnread: null,
  };

  if (company) {
    const [{ data: documents }, { data: diligenceReport }, investorActivity, remediation, progressRows, spvCountRes] =
      await Promise.all([
        listCompanyDocuments(supabase, company.id),
        getLatestDiligenceReport(supabase, company.id),
        listFounderInvestorActivity(supabase, company.id),
        loadFounderRemediationPlan(profile),
        listLessonProgressForCompany(profile.id, company.id),
        supabase
          .from("spv_opportunities")
          .select("id", { count: "exact", head: true })
          .eq("company_id", company.id),
      ]);

    const docs = documents ?? [];
    const checklist = buildDocumentChecklist(docs);
    const onboarding = computeFounderOnboardingProgress({
      company,
      documents: docs,
      diligenceReportExists: Boolean(diligenceReport),
      storedStepState: company.onboarding_step_state,
    });

    const uploadedTypeCodes = docs.flatMap((doc) => (doc.document_type ? [doc.document_type] : []));
    const computedScore = computeReadinessScore(uploadedTypeCodes);

    summary.onboardingPercent = onboarding.percent;
    summary.currentOnboardingStep = onboarding.currentStep;
    summary.pitchDeckUploaded = onboarding.pitchDeckUploaded;
    summary.documentsUploadedCount = checklist.filter((item) => item.status !== "missing").length;
    summary.documentsRequiredCount = checklist.length;
    summary.documentsMissingCount = checklist.filter((item) => item.status === "missing").length;
    summary.readinessScore = diligenceReport?.readiness_score ?? computedScore;
    summary.remediationActiveCount = remediation.summary.active;
    summary.remediationHighPriorityCount = remediation.tasks.filter((task) => task.priority === "high" && task.status !== "completed" && task.status !== "dismissed").length;
    summary.isPublished = Boolean(company.is_published);
    summary.reviewStatus = company.review_status ?? company.status ?? null;
    summary.investorInterestCount = investorActivity?.interests.length ?? 0;
    summary.introRequestCount = investorActivity?.introRequests.length ?? 0;
    summary.savedDealsCount = investorActivity?.savedDeals.length ?? 0;
    summary.spvParticipationCount = spvCountRes.count ?? 0;

    // Investor-fit profile categories (some columns from migration 20260803002
    // aren't in the generated Company type yet, so read via a Record view). These
    // let the assistant recognize, explain, and help complete the profile.
    const cx = company as unknown as Record<string, unknown>;
    const strOrNull = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
    summary.industry = company.industry ?? null;
    summary.revenueStage = company.revenue_stage ?? null;
    summary.amountOfCapital = company.funding_amount ?? null;
    summary.useOfFunds = strOrNull(company.use_of_funds);
    summary.seekingInvestorTypes = strOrNull(cx.seeking_investor_types);
    summary.seekingCapitalTypes = strOrNull(cx.seeking_capital_types);
    summary.activeInvestorPreference = strOrNull(cx.active_investor_preference);
    summary.fundingStage = strOrNull(cx.funding_stage);
    summary.operatingStage = strOrNull(cx.operating_stage);
    summary.annualEbitda = strOrNull(cx.annual_ebitda);
    summary.managementTeam = strOrNull(cx.management_team);
    summary.businessEntity = strOrNull(cx.business_entity);

    const fitMissing = [
      !summary.seekingInvestorTypes && "type of investor(s)",
      !summary.seekingCapitalTypes && "type(s) of capital",
      !summary.amountOfCapital && "amount of capital",
      !summary.fundingStage && "funding stage",
      !summary.operatingStage && "operating stage",
      !summary.businessEntity && "business entity",
      !summary.annualEbitda && "annual EBITDA",
      !summary.managementTeam && "management team",
    ].filter((v): v is string => Boolean(v));
    if (fitMissing.length > 0) {
      highlights.push(`Investor-fit profile is missing: ${fitMissing.join(", ")}. Completing these in Settings → Company Profile sharpens investor matches.`);
    }

    if (FOUNDER_COURSES.length > 0) {
      summary.learningPercentComplete = Math.round(
        FOUNDER_COURSES.reduce(
          (sum, course) => sum + computeCoursePercentComplete(course, progressRows),
          0,
        ) / FOUNDER_COURSES.length,
      );
    } else {
      summary.learningPercentComplete = 0;
    }

    if (!onboarding.isComplete) {
      highlights.push(`Onboarding is ${onboarding.percent}% complete — current step: ${onboarding.currentStep.replaceAll("_", " ")}.`);
    }
    if (Number(summary.documentsMissingCount) > 0) {
      highlights.push(`${summary.documentsMissingCount} required diligence documents are still missing.`);
    }
    if (Number(summary.remediationActiveCount) > 0) {
      highlights.push(`${summary.remediationActiveCount} remediation tasks are open.`);
    }
    if (Number(summary.investorInterestCount) > 0) {
      highlights.push(`${summary.investorInterestCount} investors have expressed non-binding interest.`);
    }
  } else {
    highlights.push("No company profile is linked — complete onboarding to unlock readiness and document workflows.");
  }

  const { count: unreadCount } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_user_id", profile.id)
    .eq("is_read", false);
  summary.notificationsUnread = unreadCount ?? 0;

  const entityFromPath = parseEntityFromPath(currentPath);
  const entity =
    input.entityType && input.entityId
      ? { type: input.entityType, id: input.entityId, label: null }
      : entityFromPath
        ? { type: entityFromPath.type, id: entityFromPath.id, label: null }
        : company
          ? { type: "company", id: company.id, label: company.company_name ?? null }
          : null;

  return {
    role: "founder",
    mode,
    workspaceLabel: workspaceLabelForRole("founder"),
    currentPath,
    entity,
    summary,
    highlights,
  };
}
