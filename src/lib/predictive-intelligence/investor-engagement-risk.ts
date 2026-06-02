import type { PlatformAnalyticsSnapshot } from "@/lib/analytics/types";
import { clampScore, confidenceLabel, severityFromScore, weightedScore } from "@/lib/predictive-intelligence/scoring";
import type { RiskSignal } from "@/lib/predictive-intelligence/types";

export function computeInvestorEngagementRiskSignals(input: {
  analytics: PlatformAnalyticsSnapshot;
}): RiskSignal[] {
  const now = new Date().toISOString();
  const parts: Array<{ score: number; weight: number }> = [];
  const reasonCodes: string[] = [];

  const interests = input.analytics.trends.investorEngagement.find((s) => s.key === "interests")?.total ?? 0;
  const intros = input.analytics.trends.investorEngagement.find((s) => s.key === "intros")?.total ?? 0;
  const saved = input.analytics.trends.investorEngagement.find((s) => s.key === "saved")?.total ?? 0;

  if (interests === 0) {
    parts.push({ score: 75, weight: 2 });
    reasonCodes.push("no_interests");
  } else if (interests < 5 && input.analytics.windowDays <= 30) {
    parts.push({ score: 55, weight: 1 });
    reasonCodes.push("low_interests");
  }

  if (intros === 0 && interests > 10) {
    parts.push({ score: 60, weight: 1 });
    reasonCodes.push("interests_without_intros");
  }

  if (saved > 0 && intros === 0 && interests === 0) {
    parts.push({ score: 45, weight: 1 });
    reasonCodes.push("saved_without_downstream_actions");
  }

  const score = weightedScore(parts);
  const severity = severityFromScore(score);
  const confidence = confidenceLabel({ dataCoverage: "high", deterministic: true });

  const explanation = `Engagement totals (last ${input.analytics.windowDays} days): ${interests} interests, ${intros} intro requests, ${saved} saved deals.`;

  return [
    {
      id: `investor_engagement_risk:platform:${input.analytics.windowDays}`,
      type: "investor_engagement_risk",
      severity,
      score: clampScore(score),
      confidence,
      reasonCodes,
      title: "Investor engagement risk",
      explanation,
      entityType: "platform",
      entityId: null,
      href: "/admin/analytics",
      sourceData: { interests, intros, saved, windowDays: input.analytics.windowDays },
      generatedAt: now,
    },
  ];
}

