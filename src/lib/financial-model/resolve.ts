// Resolves a (possibly partial) set of drivers into a complete, sane
// ProjectionAssumptions. Used by both the financial-model API and client so
// reused business-plan drivers and fresh inputs go through the same guard.

import type { ProjectionAssumptions } from "@/lib/business-plan/projections";
import { defaultAssumptions } from "@/lib/business-plan/assumptions";

const NON_NEGATIVE: Array<keyof ProjectionAssumptions> = [
  "startingCustomers",
  "monthlyGrowthPct",
  "pricePerMonth",
  "grossMarginPct",
  "monthlyBurn",
  "raiseAmount",
];

export function resolveAssumptions(
  partial: Partial<ProjectionAssumptions> | null | undefined,
  stage: string | null,
  raiseAmount?: number | null,
): ProjectionAssumptions {
  const base = defaultAssumptions(stage, raiseAmount);
  const merged: ProjectionAssumptions = { ...base };

  for (const key of NON_NEGATIVE) {
    const v = partial?.[key];
    if (typeof v === "number" && Number.isFinite(v)) merged[key] = v;
  }

  // Clamp to defensible ranges so the workbook never produces nonsense.
  merged.startingCustomers = Math.max(0, Math.round(merged.startingCustomers));
  merged.monthlyGrowthPct = Math.min(100, Math.max(0, merged.monthlyGrowthPct));
  merged.pricePerMonth = Math.max(0, merged.pricePerMonth);
  merged.grossMarginPct = Math.min(100, Math.max(0, merged.grossMarginPct));
  merged.monthlyBurn = Math.max(0, merged.monthlyBurn);
  merged.raiseAmount = Math.max(0, merged.raiseAmount);

  return merged;
}
