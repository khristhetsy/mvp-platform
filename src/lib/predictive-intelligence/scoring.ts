import type { RiskConfidence, RiskSeverity } from "@/lib/predictive-intelligence/types";

export function clampScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.min(100, Math.max(0, Math.round(score)));
}

export function severityFromScore(score: number): RiskSeverity {
  const s = clampScore(score);
  if (s >= 85) return "critical";
  if (s >= 65) return "high";
  if (s >= 40) return "medium";
  return "low";
}

export function confidenceLabel(input: {
  dataCoverage: "low" | "medium" | "high";
  deterministic: true;
}): RiskConfidence {
  if (input.dataCoverage === "high") return "high";
  if (input.dataCoverage === "medium") return "medium";
  return "low";
}

export function weightedScore(parts: Array<{ score: number; weight: number }>): number {
  if (parts.length === 0) return 0;
  const totalWeight = parts.reduce((sum, p) => sum + p.weight, 0) || 1;
  const raw = parts.reduce((sum, p) => sum + clampScore(p.score) * p.weight, 0) / totalWeight;
  return clampScore(raw);
}

