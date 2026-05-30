import { getComplianceMetrics } from "@/lib/compliance/events";
import { getAdminDashboardMetrics } from "@/lib/data/admin";
import { getFounderOutreachAdminSummary } from "@/lib/founder-crm/admin-outreach-summary";
import { getGlobalModuleEngagementCounts } from "@/lib/learning/progress";
import { summarizeRemediationTasks } from "@/lib/remediation/tasks";
import type { RemediationTaskRecord } from "@/lib/remediation/types";
import { createServiceRoleClient } from "@/lib/supabase/admin";

export type AdminAnalyticsSnapshot = {
  totalFounders: number;
  totalInvestors: number;
  companiesOnboarded: number;
  pendingReviews: number;
  publishedDeals: number;
  onboardingAveragePercent: number;
  readinessAverageScore: number | null;
  remediation: ReturnType<typeof summarizeRemediationTasks>;
  learningEngagementRows: number;
  outreach: Awaited<ReturnType<typeof getFounderOutreachAdminSummary>>;
  messageThreadCount: number;
  meetingsScheduled: number;
  notificationsTotal: number;
  upgradeRequestsPending: number;
  planDistribution: Array<{ plan: string; count: number }>;
  platformOutreachTargets: number;
  approvedInvestors: number;
  compliance: {
    openEvents: number;
    criticalEvents: number;
    flaggedSocialEvents: number;
    flaggedOutreachEvents: number;
    outreachAbuseIndicators: number;
  };
};

export async function loadAdminAnalytics(): Promise<AdminAnalyticsSnapshot> {
  const admin = createServiceRoleClient();

  const [
    metrics,
    investors,
    companies,
    diligenceReports,
    remediationRows,
    learningEngagement,
    outreach,
    threads,
    meetings,
    notifications,
    upgradePending,
    subscriptions,
    platformTargets,
    approvedInvestors,
    compliance,
  ] = await Promise.all([
    getAdminDashboardMetrics(admin),
    admin.from("profiles").select("id", { count: "exact", head: true }).ilike("role", "investor"),
    admin.from("companies").select("onboarding_progress_percent"),
    admin.from("diligence_reports").select("readiness_score"),
    admin.from("founder_remediation_tasks").select("status"),
    getGlobalModuleEngagementCounts(),
    getFounderOutreachAdminSummary(),
    admin.from("message_threads").select("id", { count: "exact", head: true }),
    admin.from("thread_meetings").select("id", { count: "exact", head: true }).eq("status", "scheduled"),
    admin.from("notifications").select("id", { count: "exact", head: true }),
    admin.from("upgrade_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
    admin.from("subscriptions").select("plan_type"),
    admin
      .from("founder_outreach_targets")
      .select("id", { count: "exact", head: true })
      .not("platform_investor_id", "is", null),
    admin.from("investor_profiles").select("id", { count: "exact", head: true }).eq("approval_status", "approved"),
    getComplianceMetrics(admin),
  ]);

  const onboardingValues = (companies.data ?? [])
    .map((row) => row.onboarding_progress_percent)
    .filter((value): value is number => value != null && value >= 0);
  const onboardingAveragePercent =
    onboardingValues.length > 0
      ? Math.round(onboardingValues.reduce((sum, value) => sum + value, 0) / onboardingValues.length)
      : 0;

  const readinessValues = (diligenceReports.data ?? [])
    .map((row) => row.readiness_score)
    .filter((value): value is number => value != null);
  const readinessAverageScore =
    readinessValues.length > 0
      ? Math.round(readinessValues.reduce((sum, value) => sum + value, 0) / readinessValues.length)
      : null;

  const remediation = summarizeRemediationTasks(
    (remediationRows.data ?? []) as RemediationTaskRecord[],
  );

  const planCounts = new Map<string, number>();
  for (const row of subscriptions.data ?? []) {
    const plan = String(row.plan_type ?? "unknown");
    planCounts.set(plan, (planCounts.get(plan) ?? 0) + 1);
  }

  const planDistribution = [...planCounts.entries()]
    .map(([plan, count]) => ({ plan, count }))
    .sort((a, b) => b.count - a.count);

  return {
    totalFounders: metrics.founders,
    totalInvestors: investors.count ?? 0,
    companiesOnboarded: metrics.companies,
    pendingReviews: metrics.pendingReviews,
    publishedDeals: metrics.publishedDeals,
    onboardingAveragePercent,
    readinessAverageScore,
    remediation,
    learningEngagementRows: [...learningEngagement.values()].reduce((sum, count) => sum + count, 0),
    outreach,
    messageThreadCount: threads.count ?? 0,
    meetingsScheduled: meetings.count ?? 0,
    notificationsTotal: notifications.count ?? 0,
    upgradeRequestsPending: upgradePending.count ?? 0,
    planDistribution,
    platformOutreachTargets: platformTargets.count ?? 0,
    approvedInvestors: approvedInvestors.count ?? 0,
    compliance,
  };
}
