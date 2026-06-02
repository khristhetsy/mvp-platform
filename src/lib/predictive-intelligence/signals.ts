import { createServiceRoleClient } from "@/lib/supabase/admin";
import { clampTrendWindowDays } from "@/lib/analytics/display";
import { loadPlatformAnalyticsSnapshot } from "@/lib/analytics/metrics";
import type { PlatformAnalyticsSnapshot } from "@/lib/analytics/types";
import type { PlatformInsightsSnapshot, RiskSignal } from "@/lib/predictive-intelligence/types";
import { computeInvestorEngagementRiskSignals } from "@/lib/predictive-intelligence/investor-engagement-risk";
import { computeComplianceRiskSignals } from "@/lib/predictive-intelligence/compliance-risk";
import { computeWorkflowSystemRiskSignals } from "@/lib/predictive-intelligence/workflow-risk";
import { buildRecommendations } from "@/lib/predictive-intelligence/recommendations";

export async function loadPlatformInsights(input?: { window?: string | null }): Promise<PlatformInsightsSnapshot> {
  const windowDays = clampTrendWindowDays(input?.window ?? null);
  const supabase = createServiceRoleClient();
  const analytics = await loadPlatformAnalyticsSnapshot(supabase, windowDays);

  const platformSignals = computePlatformSignals(analytics);
  const recommendations = buildRecommendations(platformSignals);

  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const s of platformSignals) counts[s.severity] += 1;
  const scoreAvg =
    platformSignals.length > 0
      ? Math.round(platformSignals.reduce((sum, s) => sum + s.score, 0) / platformSignals.length)
      : 0;

  return {
    windowDays,
    generatedAt: new Date().toISOString(),
    riskOverview: { ...counts, scoreAvg },
    signals: platformSignals.sort((a, b) => b.score - a.score),
    recommendations,
  };
}

export function computePlatformSignals(analytics: PlatformAnalyticsSnapshot): RiskSignal[] {
  return [
    ...computeInvestorEngagementRiskSignals({ analytics }),
    ...computeComplianceRiskSignals({ analytics }),
    ...computeWorkflowSystemRiskSignals({ analytics }),
  ];
}

export function isPredictiveInsightsIntent(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("risk") ||
    lower.includes("risks") ||
    lower.includes("predictive") ||
    lower.includes("insights") ||
    lower.includes("likely stuck") ||
    lower.includes("bottleneck") ||
    lower.includes("what should i prioritize") ||
    lower.includes("what should we prioritize")
  );
}

export async function formatPredictiveInsightsForAssistant(message: string): Promise<string> {
  const lower = message.toLowerCase();
  const window = lower.includes("90") ? "90" : lower.includes("7") ? "7" : "30";
  const snapshot = await loadPlatformInsights({ window });

  const top = snapshot.signals
    .filter((s) => s.severity === "critical" || s.severity === "high")
    .slice(0, 6);

  const lines: string[] = [
    `**Predictive intelligence (rules-based, last ${snapshot.windowDays} days)**`,
    "",
    `Risk overview: ${snapshot.riskOverview.critical} critical · ${snapshot.riskOverview.high} high · ${snapshot.riskOverview.medium} medium · avg score ${snapshot.riskOverview.scoreAvg}/100.`,
  ];

  if (lower.includes("compliance")) {
    const compliance = snapshot.signals.filter((s) => s.type === "compliance_risk")[0];
    if (compliance) {
      lines.push("", `**Compliance risk:** ${compliance.severity} (${compliance.score}/100) — ${compliance.explanation}`);
    }
  } else if (lower.includes("spv")) {
    lines.push("", "SPV delay risk is evaluated per SPV in the SPV workspace (Admin → SPVs).");
  } else if (lower.includes("company")) {
    lines.push("", "Company readiness risk is evaluated per company in the company workspace (Admin → Companies → Company).");
  } else if (lower.includes("prioritize") || lower.includes("what should")) {
    lines.push("", "**Recommended priorities:**");
    for (const rec of snapshot.recommendations.slice(0, 5)) {
      lines.push(`• ${rec.title} — ${rec.recommendedAction}`);
    }
  } else {
    lines.push("", "**Top increasing risks (rules-based):**");
    if (top.length === 0) {
      lines.push("• No high-severity risks detected in the current snapshot.");
    } else {
      for (const s of top) {
        lines.push(`• ${s.title}: ${s.severity} (${s.score}/100) — ${s.explanation}`);
      }
    }
  }

  lines.push("", "Open **/admin/insights** for drill-down and export (JSON/CSV).");
  return lines.join("\n");
}

