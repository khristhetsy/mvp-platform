import type { AdminCompanyWorkspaceData } from "@/lib/admin/company-workspace-types";
import { clampScore, confidenceLabel, severityFromScore, weightedScore } from "@/lib/predictive-intelligence/scoring";
import type { RiskSignal } from "@/lib/predictive-intelligence/types";

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms)) return null;
  return Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)));
}

export function computeCompanyReadinessRiskSignals(input: {
  companyId: string;
  workspace: AdminCompanyWorkspaceData;
}): RiskSignal[] {
  const now = new Date().toISOString();
  const signals: RiskSignal[] = [];

  const latestScore = input.workspace.readiness.latestScore;
  const onboardingPct = input.workspace.readiness.onboardingPercent ?? 0;
  const onboardingDays = daysSince(input.workspace.company.created_at ?? null);
  const onboardingCompletedAt = input.workspace.readiness.onboardingCompletedAt;
  const remediationActive = input.workspace.readiness.remediation.active ?? 0;
  const remediationHigh = input.workspace.readiness.remediation.highPriorityOpen ?? 0;
  const pitchDeckPresent = Boolean(input.workspace.documents.pitchDeckPresent);
  const missingHintsCount = input.workspace.documents.missingRequiredHints?.length ?? 0;
  const investorActivityTotal =
    (input.workspace.investorActivity.interests ?? 0) +
    (input.workspace.investorActivity.introRequests ?? 0) +
    (input.workspace.investorActivity.savedDeals ?? 0);

  const scoreParts: Array<{ score: number; weight: number }> = [];
  const reasonCodes: string[] = [];

  if (latestScore != null) {
    const readinessPenalty = latestScore < 40 ? 95 : latestScore < 60 ? 80 : latestScore < 70 ? 55 : 20;
    scoreParts.push({ score: readinessPenalty, weight: 3 });
    if (latestScore < 60) reasonCodes.push("low_readiness_score");
  } else {
    scoreParts.push({ score: 35, weight: 1 });
    reasonCodes.push("missing_readiness_score");
  }

  if (!onboardingCompletedAt && onboardingPct < 60 && (onboardingDays ?? 0) >= 30) {
    scoreParts.push({ score: 70, weight: 2 });
    reasonCodes.push("stale_onboarding");
  } else if (!onboardingCompletedAt && onboardingPct < 60) {
    scoreParts.push({ score: 45, weight: 1 });
    reasonCodes.push("onboarding_incomplete");
  }

  if (remediationHigh > 0) {
    scoreParts.push({ score: 85, weight: 2 });
    reasonCodes.push("remediation_high_priority_open");
  } else if (remediationActive > 0) {
    scoreParts.push({ score: 60, weight: 1 });
    reasonCodes.push("remediation_open");
  }

  if (!pitchDeckPresent) {
    scoreParts.push({ score: 55, weight: 1 });
    reasonCodes.push("missing_pitch_deck");
  }
  if (missingHintsCount > 0) {
    scoreParts.push({ score: Math.min(80, 40 + missingHintsCount * 10), weight: 1 });
    reasonCodes.push("missing_required_documents");
  }

  if (investorActivityTotal === 0) {
    scoreParts.push({ score: 55, weight: 1 });
    reasonCodes.push("no_investor_activity");
  }

  const score = weightedScore(scoreParts);
  const severity = severityFromScore(score);
  const confidence = confidenceLabel({
    dataCoverage: latestScore != null ? "high" : "medium",
    deterministic: true,
  });

  const explanation = [
    latestScore != null ? `Readiness score: ${latestScore}.` : "No readiness score recorded yet.",
    onboardingCompletedAt ? "Onboarding complete." : `Onboarding: ${onboardingPct}%.`,
    remediationActive > 0 ? `${remediationActive} remediation task(s) active.` : "No active remediation tasks.",
    !pitchDeckPresent ? "Pitch deck missing." : "Pitch deck present.",
    investorActivityTotal === 0 ? "No investor activity recorded for this company." : "Investor activity present.",
  ].join(" ");

  signals.push({
    id: `readiness_risk:company:${input.companyId}`,
    type: "readiness_risk",
    severity,
    score: clampScore(score),
    confidence,
    reasonCodes,
    title: "Readiness risk (company)",
    explanation,
    entityType: "company",
    entityId: input.companyId,
    companyId: input.companyId,
    href: `/admin/companies/${input.companyId}`,
    sourceData: {
      latestScore,
      onboardingPct,
      remediationActive,
      remediationHigh,
      pitchDeckPresent,
      missingHintsCount,
      investorActivityTotal,
    },
    generatedAt: now,
  });

  return signals;
}

