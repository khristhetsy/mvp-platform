import type { PlatformAnalyticsSnapshot } from "@/lib/analytics/types";
import { clampScore, confidenceLabel, severityFromScore, weightedScore } from "@/lib/predictive-intelligence/scoring";
import type { RiskSignal } from "@/lib/predictive-intelligence/types";

export function computeWorkflowSystemRiskSignals(input: {
  analytics: PlatformAnalyticsSnapshot;
}): RiskSignal[] {
  const now = new Date().toISOString();
  const parts: Array<{ score: number; weight: number }> = [];
  const reasonCodes: string[] = [];

  const overdue = input.analytics.metrics.overdueActions ?? 0;
  const failedImports = input.analytics.metrics.importsFailedWindow ?? 0;
  const automationFailed = input.analytics.metrics.automationRunsFailedOrPartial ?? 0;

  if (overdue > 75) {
    parts.push({ score: 90, weight: 3 });
    reasonCodes.push("actions_overdue_spike");
  } else if (overdue > 25) {
    parts.push({ score: 70, weight: 2 });
    reasonCodes.push("actions_overdue");
  } else if (overdue > 0) {
    parts.push({ score: 45, weight: 1 });
    reasonCodes.push("some_actions_overdue");
  }

  if (failedImports > 0) {
    parts.push({ score: Math.min(85, 55 + failedImports * 5), weight: 2 });
    reasonCodes.push("import_failures");
  }

  if (automationFailed > 0) {
    parts.push({ score: Math.min(75, 45 + automationFailed * 5), weight: 1 });
    reasonCodes.push("automation_failures");
  }

  const score = weightedScore(parts);
  const severity = severityFromScore(score);
  const confidence = confidenceLabel({ dataCoverage: "high", deterministic: true });

  const explanation = `Workflow snapshot: ${overdue} overdue actions, ${failedImports} failed imports (window), ${automationFailed} failed/partial automation runs (window).`;

  const base: Omit<RiskSignal, "id" | "type" | "title"> = {
    severity,
    score: clampScore(score),
    confidence,
    reasonCodes,
    explanation,
    entityType: "platform",
    entityId: null,
    href: "/admin/actions",
    sourceData: { overdue, failedImports, automationFailed, windowDays: input.analytics.windowDays },
    generatedAt: now,
  };

  return [
    {
      id: `workflow_stall_risk:platform:${input.analytics.windowDays}`,
      type: "workflow_stall_risk",
      title: "Workflow stall risk",
      ...base,
    },
    {
      id: `action_overdue_risk:platform:${input.analytics.windowDays}`,
      type: "action_overdue_risk",
      title: "Overdue action risk",
      ...base,
      href: "/admin/actions?tab=overdue&overdue=true",
    },
    {
      id: `import_failure_risk:platform:${input.analytics.windowDays}`,
      type: "import_failure_risk",
      title: "Import failure risk",
      ...base,
      href: "/admin/imports",
    },
    {
      id: `automation_failure_risk:platform:${input.analytics.windowDays}`,
      type: "automation_failure_risk",
      title: "Automation failure risk",
      ...base,
      href: "/admin/automation",
    },
  ];
}

