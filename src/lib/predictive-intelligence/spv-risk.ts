import type { SpvExecutionReadinessSummary } from "@/lib/document-execution/types";
import type { SpvOpportunityRecord } from "@/lib/spv/types";
import { clampScore, confidenceLabel, severityFromScore, weightedScore } from "@/lib/predictive-intelligence/scoring";
import type { RiskSignal } from "@/lib/predictive-intelligence/types";

export function computeSpvDelayRiskSignals(input: {
  spv: SpvOpportunityRecord;
  execution?: SpvExecutionReadinessSummary | null;
  criticalComplianceOpenCount: number;
}): RiskSignal[] {
  const now = new Date().toISOString();
  const reasonCodes: string[] = [];
  const parts: Array<{ score: number; weight: number }> = [];

  const pendingReqs = input.spv.investor_pending_requirements_count ?? 0;
  if (pendingReqs > 0) {
    parts.push({ score: Math.min(85, 45 + pendingReqs * 5), weight: 2 });
    reasonCodes.push("investor_requirements_pending");
  }

  const packagePct = input.spv.package_readiness_pct ?? 0;
  if (packagePct < 70) {
    parts.push({ score: 75, weight: 2 });
    reasonCodes.push("package_readiness_incomplete");
  } else if (packagePct < 90) {
    parts.push({ score: 50, weight: 1 });
    reasonCodes.push("package_readiness_partial");
  }

  const closingPct = input.spv.closing_readiness_pct ?? 0;
  if (closingPct < 70) {
    parts.push({ score: 70, weight: 2 });
    reasonCodes.push("closing_readiness_blocked");
  } else if (closingPct < 90) {
    parts.push({ score: 45, weight: 1 });
    reasonCodes.push("closing_readiness_partial");
  }

  if (input.criticalComplianceOpenCount > 0) {
    parts.push({ score: 90, weight: 3 });
    reasonCodes.push("critical_compliance_open");
  }

  if (input.spv.status === "draft") {
    parts.push({ score: 40, weight: 1 });
    reasonCodes.push("spv_inactive_draft");
  }

  const executionPct = input.execution?.executionReadinessPct ?? null;
  if (executionPct != null && executionPct < 80) {
    parts.push({ score: 60, weight: 1 });
    reasonCodes.push("execution_packages_incomplete");
  }

  const score = weightedScore(parts);
  const severity = severityFromScore(score);
  const confidence = confidenceLabel({ dataCoverage: input.execution ? "high" : "medium", deterministic: true });

  const explanation = [
    pendingReqs > 0 ? `${pendingReqs} pending investor requirement(s).` : "No pending investor requirements.",
    `Package readiness: ${packagePct}%.`,
    `Closing readiness: ${closingPct}%.`,
    input.criticalComplianceOpenCount > 0
      ? `${input.criticalComplianceOpenCount} critical compliance open.`
      : "No critical compliance open.",
    executionPct != null ? `Execution readiness: ${executionPct}%.` : null,
  ]
    .filter(Boolean)
    .join(" ");

  return [
    {
      id: `spv_delay_risk:spv:${input.spv.id}`,
      type: "spv_delay_risk",
      severity,
      score: clampScore(score),
      confidence,
      reasonCodes,
      title: "SPV delay risk",
      explanation,
      entityType: "spv",
      entityId: input.spv.id,
      spvId: input.spv.id,
      companyId: input.spv.company_id,
      href: "/admin/spvs",
      sourceData: {
        pendingReqs,
        packagePct,
        closingPct,
        criticalComplianceOpenCount: input.criticalComplianceOpenCount,
        executionPct,
      },
      generatedAt: now,
    },
  ];
}

