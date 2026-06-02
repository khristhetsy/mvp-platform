import type { PlatformCoreMetrics } from "@/lib/analytics/types";

export function computePlatformHealth(metrics: PlatformCoreMetrics): {
  score: "healthy" | "degraded" | "unhealthy";
  reasons: string[];
} {
  const reasons: string[] = [];

  if (metrics.pendingCompanyReviews > 10) reasons.push(`${metrics.pendingCompanyReviews} companies pending review`);
  if (metrics.overdueActions > 25) reasons.push(`${metrics.overdueActions} overdue actions`);
  if (metrics.complianceCriticalOpen > 0) reasons.push(`${metrics.complianceCriticalOpen} critical compliance open`);
  if (metrics.importsFailedWindow > 0) reasons.push(`${metrics.importsFailedWindow} failed imports in window`);
  if (metrics.automationRunsFailedOrPartial > 0) reasons.push(`${metrics.automationRunsFailedOrPartial} failed/partial automation runs in window`);

  if (metrics.complianceCriticalOpen > 3 || metrics.overdueActions > 75) {
    return { score: "unhealthy", reasons };
  }
  if (reasons.length > 0) {
    return { score: "degraded", reasons };
  }
  return { score: "healthy", reasons: ["No critical operational backlogs detected in core systems."] };
}

