import type { PlatformAnalyticsSnapshot } from "@/lib/analytics/types";
import { clampScore, confidenceLabel, severityFromScore, weightedScore } from "@/lib/predictive-intelligence/scoring";
import type { RiskSignal } from "@/lib/predictive-intelligence/types";

export function computeComplianceRiskSignals(input: {
  analytics: PlatformAnalyticsSnapshot;
}): RiskSignal[] {
  const now = new Date().toISOString();
  const parts: Array<{ score: number; weight: number }> = [];
  const reasonCodes: string[] = [];

  const critical = input.analytics.metrics.complianceCriticalOpen ?? 0;
  const open = input.analytics.metrics.complianceOpen ?? 0;

  if (critical > 0) {
    parts.push({ score: 95, weight: 3 });
    reasonCodes.push("critical_compliance_open");
  }
  if (open > 10) {
    parts.push({ score: 70, weight: 2 });
    reasonCodes.push("high_open_compliance_volume");
  } else if (open > 0) {
    parts.push({ score: 45, weight: 1 });
    reasonCodes.push("open_compliance_events");
  }

  const created = input.analytics.trends.compliance.find((s) => s.key === "compliance_created")?.total ?? 0;
  const resolved = input.analytics.trends.compliance.find((s) => s.key === "compliance_resolved")?.total ?? 0;
  if (created > resolved && created >= 5) {
    parts.push({ score: 60, weight: 1 });
    reasonCodes.push("compliance_inflow_gt_resolved");
  }

  const score = weightedScore(parts);
  const severity = severityFromScore(score);
  const confidence = confidenceLabel({ dataCoverage: "high", deterministic: true });

  const explanation = `Compliance snapshot: ${open} open, ${critical} critical. Window totals: ${created} created vs ${resolved} resolved.`;

  return [
    {
      id: `compliance_risk:platform:${input.analytics.windowDays}`,
      type: "compliance_risk",
      severity,
      score: clampScore(score),
      confidence,
      reasonCodes,
      title: "Compliance risk",
      explanation,
      entityType: "platform",
      entityId: null,
      href: "/admin/compliance",
      sourceData: { open, critical, created, resolved, windowDays: input.analytics.windowDays },
      generatedAt: now,
    },
  ];
}

