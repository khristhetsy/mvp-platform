import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getOperationalActivityFeed } from "@/lib/operational-activity/event-queries";
import { buildLaunchReadinessSnapshot, type LaunchReadinessSnapshot } from "@/lib/operations/launch-readiness";
import {
  averageActivationDays,
  loadFounderActivationRows,
  loadInvestorActivationRows,
  type FounderActivationRow,
  type InvestorActivationRow,
} from "@/lib/operations/beta-activation";
import { detectBetaInactivityFlags, type InactivityFlag } from "@/lib/operations/beta-inactivity";
import { loadBetaUsageAnalytics, type BetaUsageAnalytics } from "@/lib/operations/beta-usage-analytics";

export type BetaFeedbackRow = {
  id: string;
  profileId: string;
  role: string;
  category: string;
  severity: string;
  message: string;
  screenshotUrl: string | null;
  status: string;
  createdAt: string;
  submitterName: string | null;
};

export type BetaOperationsSnapshot = {
  generatedAt: string;
  launchReadiness: LaunchReadinessSnapshot;
  summary: {
    activeFounders: number;
    activeInvestors: number;
    founderOnboardingCompletionPercent: number;
    pendingFounderOnboarding: number;
    pendingInvestorApprovals: number;
    openBetaFeedback: number;
    inactiveFounders: number;
    inactiveInvestors: number;
    averageFounderActivationDays: number | null;
    averageInvestorActivationDays: number | null;
  };
  reliability: LaunchReadinessSnapshot["environment"] & {
    migrationsVerified: boolean;
    cronOperational: boolean;
  };
  operations: LaunchReadinessSnapshot["operations"] & {
    failedNotifications: number;
    failedUploads: number;
    openDiligenceItems: number;
    dealRoomActivityLast7d: number;
  };
  founders: FounderActivationRow[];
  investors: InvestorActivationRow[];
  inactivityFlags: InactivityFlag[];
  usage: BetaUsageAnalytics;
  recentEvents: Awaited<ReturnType<typeof getOperationalActivityFeed>>["items"];
  feedbackQueue: BetaFeedbackRow[];
};

function sinceDays(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function countFrom(result: { count: number | null; error: unknown }) {
  if (result.error) return 0;
  return result.count ?? 0;
}

async function loadBetaFeedbackQueue(admin: ReturnType<typeof createServiceRoleClient>): Promise<BetaFeedbackRow[]> {
  const { data, error } = await admin
    .from("beta_feedback")
    .select("id, profile_id, role, category, severity, message, screenshot_url, status, created_at, profiles(full_name, email)")
    .in("status", ["open", "reviewing"])
    .order("created_at", { ascending: false })
    .limit(30);

  if (error || !data) return [];

  return data.map((row) => {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return {
      id: row.id,
      profileId: row.profile_id,
      role: row.role,
      category: row.category,
      severity: row.severity,
      message: row.message,
      screenshotUrl: row.screenshot_url,
      status: row.status,
      createdAt: row.created_at,
      submitterName: profile?.full_name ?? profile?.email ?? null,
    };
  });
}

export async function buildBetaOperationsSnapshot(): Promise<BetaOperationsSnapshot> {
  const admin = createServiceRoleClient();
  const since7d = sinceDays(7);

  const [
    launchReadiness,
    founders,
    investors,
    inactivityFlags,
    usage,
    recentFeed,
    feedbackQueue,
    activeUsersRes,
    pendingFounderOnboardingRes,
    failedNotificationsRes,
    failedUploadsRes,
    openDiligenceRes,
    dealRoomActivityRes,
  ] = await Promise.all([
    buildLaunchReadinessSnapshot(),
    loadFounderActivationRows(admin, 40),
    loadInvestorActivationRows(admin, 40),
    detectBetaInactivityFlags(admin),
    loadBetaUsageAnalytics(admin),
    getOperationalActivityFeed(admin, { limit: 25, severity: ["medium", "high", "critical"] }).catch(() => ({
      items: [],
      total: 0,
      hasMore: false,
    })),
    loadBetaFeedbackQueue(admin),
    admin
      .from("audit_logs")
      .select("user_id")
      .gte("created_at", since7d)
      .not("user_id", "is", null),
    admin
      .from("companies")
      .select("id", { count: "exact", head: true })
      .in("review_status", ["draft", "pending", "in_review"]),
    admin
      .from("integration_delivery_logs")
      .select("id", { count: "exact", head: true })
      .eq("status", "failed")
      .gte("created_at", sinceDays(30)),
    admin
      .from("audit_logs")
      .select("id", { count: "exact", head: true })
      .like("action", "%upload%failed%")
      .gte("created_at", sinceDays(30)),
    admin
      .from("diligence_reports")
      .select("id", { count: "exact", head: true })
      .is("executive_summary", null),
    admin
      .from("deal_room_activity_events")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since7d),
  ]);

  const founderProfileIds = new Set((founders ?? []).map((f) => f.profileId));
  const investorProfileIds = new Set((investors ?? []).map((i) => i.profileId));

  const activeFounderIds = new Set<string>();
  const activeInvestorIds = new Set<string>();
  for (const row of activeUsersRes.data ?? []) {
    const userId = row.user_id != null ? String(row.user_id) : null;
    if (!userId) continue;
    if (founderProfileIds.has(userId)) activeFounderIds.add(userId);
    if (investorProfileIds.has(userId)) activeInvestorIds.add(userId);
  }

  const founderCompletion =
    founders.length > 0
      ? Math.round(founders.reduce((sum, f) => sum + f.onboardingPercent, 0) / founders.length)
      : 0;

  const criticalFeed = await getOperationalActivityFeed(admin, { limit: 20 }).catch(() => ({
    items: [],
    total: 0,
    hasMore: false,
  }));

  return {
    generatedAt: new Date().toISOString(),
    launchReadiness,
    summary: {
      activeFounders: activeFounderIds.size || founders.filter((f) => f.onboardingPercent > 0).length,
      activeInvestors: activeInvestorIds.size || investors.filter((i) => i.approvalStatus === "approved").length,
      founderOnboardingCompletionPercent: founderCompletion,
      pendingFounderOnboarding: countFrom(pendingFounderOnboardingRes),
      pendingInvestorApprovals: launchReadiness.operations.pendingInvestorApprovals,
      openBetaFeedback: feedbackQueue.length,
      inactiveFounders: inactivityFlags.filter((f) => f.role === "founder" && f.flag === "inactive_7d").length,
      inactiveInvestors: inactivityFlags.filter((f) => f.role === "investor" && f.flag === "inactive_7d").length,
      averageFounderActivationDays: averageActivationDays(founders, "onboarding_completed"),
      averageInvestorActivationDays: averageActivationDays(investors, "approved"),
    },
    reliability: {
      ...launchReadiness.environment,
      migrationsVerified:
        launchReadiness.migrations.ok || launchReadiness.migrations.verificationUnavailable,
      cronOperational: launchReadiness.environment.cronConfigured,
    },
    operations: {
      ...launchReadiness.operations,
      failedNotifications: countFrom(failedNotificationsRes),
      failedUploads: countFrom(failedUploadsRes),
      openDiligenceItems: countFrom(openDiligenceRes),
      dealRoomActivityLast7d: countFrom(dealRoomActivityRes),
    },
    founders,
    investors,
    inactivityFlags,
    usage,
    recentEvents: [...criticalFeed.items, ...recentFeed.items].slice(0, 30),
    feedbackQueue,
  };
}
