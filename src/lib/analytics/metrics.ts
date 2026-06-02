import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { PlatformAnalyticsSnapshot, PlatformCoreMetrics, TrendWindowDays } from "@/lib/analytics/types";
import { loadTrendGroups } from "@/lib/analytics/trends";
import { loadBottlenecks } from "@/lib/analytics/bottlenecks";
import { computePlatformHealth } from "@/lib/analytics/health";
import { createServiceRoleClient } from "@/lib/supabase/admin";

function dayStartIso(windowDays: TrendWindowDays): string {
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
  return since.toISOString();
}

function avgPct(values: Array<number | null | undefined>): number {
  const filtered = values
    .map((v) => (v == null ? null : Number(v)))
    .filter((v): v is number => v != null && Number.isFinite(v));
  if (!filtered.length) return 0;
  return Math.round(filtered.reduce((sum, v) => sum + v, 0) / filtered.length);
}

export async function loadCoreMetrics(
  supabase: SupabaseClient<Database>,
  windowDays: TrendWindowDays,
): Promise<PlatformCoreMetrics> {
  const since = dayStartIso(windowDays);

  const [
    totalCompanies,
    activeCompanies,
    publishedCompanies,
    pendingCompanyReviews,
    totalInvestors,
    approvedInvestors,
    expressedInterests,
    introRequests,
    savedDeals,
    investorInterestsAmounts,
    activeSpvs,
    spvReadinessRows,
    overdueActions,
    completedActionsWindow,
    automationRunsSucceededWindow,
    automationRunsFailedOrPartialWindow,
    complianceOpen,
    complianceCriticalOpen,
    complianceResolvedWindow,
    importsProcessedWindow,
    importsFailedWindow,
    exportsGeneratedWindow,
    collaborationCommentsWindow,
  ] = await Promise.all([
    supabase.from("companies").select("id", { count: "exact", head: true }),
    supabase
      .from("companies")
      .select("id", { count: "exact", head: true })
      .not("status", "eq", "archived"),
    supabase
      .from("companies")
      .select("id", { count: "exact", head: true })
      .eq("review_status", "approved")
      .eq("is_published", true)
      .eq("marketplace_visible", true)
      .not("published_at", "is", null),
    supabase.from("companies").select("id", { count: "exact", head: true }).eq("review_status", "pending"),
    supabase.from("profiles").select("id", { count: "exact", head: true }).ilike("role", "investor"),
    supabase.from("investor_profiles").select("id", { count: "exact", head: true }).eq("approval_status", "approved"),
    supabase.from("investor_interests").select("id", { count: "exact", head: true }),
    supabase.from("intro_requests").select("id", { count: "exact", head: true }),
    supabase.from("saved_deals").select("id", { count: "exact", head: true }),
    supabase.from("investor_interests").select("pledge_amount, interest_amount"),
    supabase
      .from("spv_opportunities")
      .select("id", { count: "exact", head: true })
      .not("status", "in", "(closed,canceled)"),
    supabase
      .from("spv_opportunities")
      .select("checklist_readiness_pct, package_readiness_pct, closing_readiness_pct")
      .limit(500),
    supabase.from("next_best_actions").select("id", { count: "exact", head: true }).eq("status", "overdue"),
    supabase
      .from("next_best_actions")
      .select("id", { count: "exact", head: true })
      .eq("status", "completed")
      .gte("updated_at", since),
    supabase
      .from("automation_runs")
      .select("id", { count: "exact", head: true })
      .eq("status", "succeeded")
      .gte("started_at", since),
    supabase
      .from("automation_runs")
      .select("id", { count: "exact", head: true })
      .in("status", ["failed", "partial"])
      .gte("started_at", since),
    supabase.from("compliance_events").select("id", { count: "exact", head: true }).in("status", ["open", "under_review"]),
    supabase
      .from("compliance_events")
      .select("id", { count: "exact", head: true })
      .in("status", ["open", "under_review"])
      .eq("severity", "critical"),
    supabase
      .from("compliance_events")
      .select("id", { count: "exact", head: true })
      .eq("status", "resolved")
      .gte("reviewed_at", since),
    supabase
      .from("import_batches")
      .select("id", { count: "exact", head: true })
      .eq("status", "completed")
      .gte("created_at", since),
    supabase
      .from("import_batches")
      .select("id", { count: "exact", head: true })
      .eq("status", "failed")
      .gte("created_at", since),
    supabase
      .from("operational_activity_events")
      .select("id", { count: "exact", head: true })
      .in("event_type", ["export_generated", "report_generated"])
      .gte("created_at", since),
    supabase
      .from("collaboration_comments")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since),
  ]);

  const totalIndicativeAmount = (investorInterestsAmounts.data ?? []).reduce((sum, row) => {
    const pledge = row.pledge_amount != null ? Number(row.pledge_amount) : 0;
    const interest = row.interest_amount != null ? Number(row.interest_amount) : 0;
    return sum + (pledge > 0 ? pledge : interest);
  }, 0);

  return {
    totalCompanies: totalCompanies.count ?? 0,
    activeCompanies: activeCompanies.count ?? totalCompanies.count ?? 0,
    publishedCompanies: publishedCompanies.count ?? 0,
    pendingCompanyReviews: pendingCompanyReviews.count ?? 0,
    totalInvestors: totalInvestors.count ?? 0,
    approvedInvestors: approvedInvestors.count ?? 0,
    expressedInterests: expressedInterests.count ?? 0,
    introRequests: introRequests.count ?? 0,
    savedDeals: savedDeals.count ?? 0,
    totalIndicativeAmount: Math.round(totalIndicativeAmount),
    activeSpvs: activeSpvs.count ?? 0,
    spvChecklistReadinessAvg: avgPct((spvReadinessRows.data ?? []).map((r) => r.checklist_readiness_pct)),
    spvPackageReadinessAvg: avgPct((spvReadinessRows.data ?? []).map((r) => r.package_readiness_pct)),
    spvClosingReadinessAvg: avgPct((spvReadinessRows.data ?? []).map((r) => r.closing_readiness_pct)),
    overdueActions: overdueActions.count ?? 0,
    completedActions: completedActionsWindow.count ?? 0,
    automationRunsSucceeded: automationRunsSucceededWindow.count ?? 0,
    automationRunsFailedOrPartial: automationRunsFailedOrPartialWindow.count ?? 0,
    complianceOpen: complianceOpen.count ?? 0,
    complianceCriticalOpen: complianceCriticalOpen.count ?? 0,
    complianceResolvedWindow: complianceResolvedWindow.count ?? 0,
    importsProcessedWindow: importsProcessedWindow.count ?? 0,
    importsFailedWindow: importsFailedWindow.count ?? 0,
    exportsGeneratedWindow: exportsGeneratedWindow.count ?? 0,
    collaborationCommentsWindow: collaborationCommentsWindow.count ?? 0,
  };
}

export async function loadPlatformAnalyticsSnapshot(
  supabase: SupabaseClient<Database>,
  windowDays: TrendWindowDays,
): Promise<PlatformAnalyticsSnapshot> {
  const [metrics, trends, bottlenecks] = await Promise.all([
    loadCoreMetrics(supabase, windowDays),
    loadTrendGroups(supabase, windowDays),
    loadBottlenecks(supabase, windowDays),
  ]);

  const health = computePlatformHealth(metrics);

  return {
    windowDays,
    generatedAt: new Date().toISOString(),
    metrics,
    trends,
    bottlenecks,
    health,
  };
}

export function isPlatformAnalyticsIntent(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("analytics") ||
    lower.includes("bi") ||
    lower.includes("bottleneck") ||
    lower.includes("platform health") ||
    lower.includes("how healthy") ||
    lower.includes("engagement trending") ||
    (lower.includes("what changed") && (lower.includes("month") || lower.includes("30")))
  );
}

export async function formatPlatformAnalyticsForAssistant(message: string): Promise<string> {
  const lower = message.toLowerCase();
  const windowDays: TrendWindowDays = lower.includes("90") ? 90 : lower.includes("7") ? 7 : 30;
  const supabase = createServiceRoleClient();
  const snapshot = await loadPlatformAnalyticsSnapshot(supabase, windowDays);

  const topBottlenecks = snapshot.bottlenecks.cards
    .filter((b) => b.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const investorEngagement = snapshot.trends.investorEngagement;
  const interests = investorEngagement.find((s) => s.key === "interests")?.total ?? 0;
  const intros = investorEngagement.find((s) => s.key === "intros")?.total ?? 0;
  const saved = investorEngagement.find((s) => s.key === "saved")?.total ?? 0;

  const lines: string[] = [
    `**Platform analytics (last ${windowDays} days)**`,
    "",
    `**Health:** ${snapshot.health.score}${snapshot.health.reasons.length ? ` — ${snapshot.health.reasons.join("; ")}` : ""}`,
    "",
    `**Investor engagement:** ${interests} interests · ${intros} intro requests · ${saved} saved deals`,
    `**SPVs:** ${snapshot.metrics.activeSpvs} active · avg readiness (checklist ${snapshot.metrics.spvChecklistReadinessAvg}% / packages ${snapshot.metrics.spvPackageReadinessAvg}% / closing ${snapshot.metrics.spvClosingReadinessAvg}%)`,
    `**Workflow:** ${snapshot.metrics.overdueActions} overdue actions · ${snapshot.metrics.completedActions} completed in window`,
    `**Automation:** ${snapshot.metrics.automationRunsSucceeded} succeeded · ${snapshot.metrics.automationRunsFailedOrPartial} failed/partial`,
    `**Compliance:** ${snapshot.metrics.complianceOpen} open · ${snapshot.metrics.complianceCriticalOpen} critical`,
    `**Imports/Exports:** ${snapshot.metrics.importsProcessedWindow} imports completed · ${snapshot.metrics.importsFailedWindow} failed · ${snapshot.metrics.exportsGeneratedWindow} exports generated`,
    `**Collaboration:** ${snapshot.metrics.collaborationCommentsWindow} comments`,
  ];

  if (lower.includes("bottleneck") || lower.includes("blocked") || lower.includes("stuck")) {
    lines.push("", "**Biggest bottlenecks:**");
    if (!topBottlenecks.length) {
      lines.push("• No high-signal bottlenecks detected in the current snapshot.");
    } else {
      for (const b of topBottlenecks) {
        lines.push(`• ${b.label}: ${b.count} — ${b.description}`);
      }
    }
  }

  lines.push("", "Open **/admin/analytics** for drill-down links and export (JSON/CSV).");
  return lines.join("\n");
}

