import { listCompanyDocuments } from "@/lib/data/documents";
import { getLatestDiligenceReport } from "@/lib/data/founder-readiness";
import { formatPledgeTotal, getCompanyPledgeSummary, getFounderPledgeCompanyId } from "@/lib/data/investor-pledges";
import { listFounderInvestorActivity } from "@/lib/data/investor-interests";
import { listFounderInvestorContacts } from "@/lib/founder-crm/contacts";
import {
  listOutreachCampaigns,
  listOutreachTargets,
} from "@/lib/founder-crm/outreach";
import { listSocialOutreachDrafts } from "@/lib/founder-crm/social-outreach-drafts";
import { computeOverallLearningPercent, listLearningProgressForCompany, listPublishedLearningModules } from "@/lib/learning/progress";
import { ensureFounderCompanyForUser } from "@/lib/onboarding/ensure-founder-setup";
import { computeFounderOnboardingProgress } from "@/lib/onboarding/progress";
import { loadFounderRemediationPlan } from "@/lib/remediation/load-founder-remediation";
import { summarizeRemediationTasks } from "@/lib/remediation/tasks";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/supabase/types";

export type FounderAnalyticsSnapshot = {
  companyName: string;
  onboardingPercent: number;
  onboardingCompletedAt: string | null;
  readinessScore: number | null;
  readinessSnapshots: Array<{ score: number | null; createdAt: string }>;
  remediation: ReturnType<typeof summarizeRemediationTasks>;
  learningPercent: number;
  learningModulesCompleted: number;
  learningModulesPublished: number;
  privateContactCount: number;
  outreachByStatus: Record<string, number>;
  campaignDraftCount: number;
  campaignQueuedCount: number;
  queuedMessageCount: number;
  socialDraftGenerated: number;
  socialDraftCopied: number;
  socialDraftFlagged: number;
  messageThreadCount: number;
  meetingsScheduled: number;
  investorInterestCount: number;
  introRequestCount: number;
  savedByInvestorsCount: number;
  pledgeTotalDisplay: string;
  pledgeInvestorCount: number;
};

function countByStatus<T extends { status: string }>(rows: T[]) {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    counts[row.status] = (counts[row.status] ?? 0) + 1;
  }
  return counts;
}

export async function loadFounderAnalytics(profile: Profile): Promise<FounderAnalyticsSnapshot | null> {
  const company = await ensureFounderCompanyForUser(profile);
  if (!company) {
    return null;
  }

  const supabase = await createServerSupabaseClient();
  const admin = createServiceRoleClient();

  const [
    documents,
    latestReport,
    reportHistory,
    remediationPlan,
    modules,
    progressRows,
    contacts,
    targets,
    campaigns,
    socialDrafts,
    threads,
    investorActivity,
    pledgeCompanyId,
  ] = await Promise.all([
    listCompanyDocuments(supabase, company.id),
    getLatestDiligenceReport(supabase, company.id),
    supabase
      .from("diligence_reports")
      .select("readiness_score, created_at")
      .eq("company_id", company.id)
      .order("created_at", { ascending: false })
      .limit(5),
    loadFounderRemediationPlan(profile),
    listPublishedLearningModules(),
    listLearningProgressForCompany(profile.id, company.id),
    listFounderInvestorContacts(supabase, profile.id, company.id),
    listOutreachTargets(supabase, profile.id, company.id),
    listOutreachCampaigns(supabase, profile.id, company.id),
    listSocialOutreachDrafts(supabase, profile.id, company.id),
    supabase.from("message_threads").select("id", { count: "exact", head: true }).eq("founder_id", profile.id).eq("company_id", company.id),
    listFounderInvestorActivity(supabase, company.id),
    getFounderPledgeCompanyId(admin, profile.id, company.id),
  ]);

  const onboarding = computeFounderOnboardingProgress({
    company,
    documents: documents.data ?? [],
    diligenceReportExists: Boolean(latestReport.data),
    storedStepState: company.onboarding_step_state,
  });

  const learningPercent = computeOverallLearningPercent(modules, progressRows);
  const learningModulesCompleted = progressRows.filter((row) => row.status === "completed").length;

  const campaignRows = campaigns.data ?? [];
  const socialRows = socialDrafts.data ?? [];
  const targetRows = (targets.data ?? []) as Array<{ status: string }>;

  const pledgeSummary = await getCompanyPledgeSummary(admin, pledgeCompanyId);

  const threadIdsForCompany = await supabase
    .from("message_threads")
    .select("id")
    .eq("founder_id", profile.id)
    .eq("company_id", company.id);

  let meetingsScheduled = 0;
  const threadIdList = (threadIdsForCompany.data ?? []).map((row) => row.id);
  if (threadIdList.length > 0) {
    const { count } = await supabase
      .from("thread_meetings")
      .select("id", { count: "exact", head: true })
      .in("thread_id", threadIdList)
      .eq("status", "scheduled");
    meetingsScheduled = count ?? 0;
  }

  const campaignIds = campaignRows.map((row) => row.id);
  let queuedForFounder = 0;
  if (campaignIds.length > 0) {
    const { count } = await admin
      .from("outreach_messages")
      .select("id", { count: "exact", head: true })
      .in("campaign_id", campaignIds)
      .eq("status", "queued");
    queuedForFounder = count ?? 0;
  }

  return {
    companyName: company.company_name,
    onboardingPercent: onboarding.percent,
    onboardingCompletedAt: company.onboarding_completed_at ?? null,
    readinessScore: latestReport.data?.readiness_score ?? null,
    readinessSnapshots: (reportHistory.data ?? []).map((row) => ({
      score: row.readiness_score,
      createdAt: row.created_at,
    })),
    remediation: summarizeRemediationTasks(remediationPlan.tasks),
    learningPercent,
    learningModulesCompleted,
    learningModulesPublished: modules.length,
    privateContactCount: contacts.data?.length ?? 0,
    outreachByStatus: countByStatus(targetRows),
    campaignDraftCount: campaignRows.filter((row) => row.status === "draft").length,
    campaignQueuedCount: campaignRows.filter((row) => ["queued", "active"].includes(row.status)).length,
    queuedMessageCount: queuedForFounder,
    socialDraftGenerated: socialRows.length,
    socialDraftCopied: socialRows.filter((row) => row.status === "copied").length,
    socialDraftFlagged: socialRows.filter((row) => row.compliance_status === "flagged").length,
    messageThreadCount: threads.count ?? 0,
    meetingsScheduled,
    investorInterestCount: investorActivity?.interests.length ?? 0,
    introRequestCount: investorActivity?.introRequests.length ?? 0,
    savedByInvestorsCount: investorActivity?.savedDeals.length ?? 0,
    pledgeTotalDisplay: formatPledgeTotal(pledgeSummary.totalPledged, pledgeSummary.currency),
    pledgeInvestorCount: pledgeSummary.investorCount,
  };
}
