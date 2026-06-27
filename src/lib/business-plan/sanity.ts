// Deterministic projection sanity checks. No AI call — instant, reliable, free.
// Flags assumptions that are unusual for the founder's stage so they can confirm
// or adjust. Educational nudges, not advice.

import type { ProjectionAssumptions, ProjectionResult } from "./projections";

export interface SanityNote {
  level: "info" | "warn";
  text: string;
}

export function checkAssumptions(
  stage: string | null,
  a: ProjectionAssumptions,
  projections: ProjectionResult | null,
): SanityNote[] {
  const notes: SanityNote[] = [];
  const early = stage === "pre_revenue" || stage === "early_revenue" || stage == null;

  // Growth rate
  const lo = early ? 8 : 5;
  const hi = early ? 15 : 12;
  if (a.monthlyGrowthPct > hi) {
    notes.push({ level: "warn", text: `${a.monthlyGrowthPct}% monthly growth is ambitious for your stage — a typical range is ${lo}–${hi}%. Keep it, or adjust.` });
  } else if (a.monthlyGrowthPct > 0 && a.monthlyGrowthPct < lo) {
    notes.push({ level: "info", text: `${a.monthlyGrowthPct}% monthly growth is on the conservative side for your stage (typical ${lo}–${hi}%).` });
  }

  // Gross margin
  if (a.grossMarginPct < 40) {
    notes.push({ level: "warn", text: `A ${a.grossMarginPct}% gross margin is low — investors will ask what drives cost of delivery.` });
  }

  // Runway
  if (projections?.runwayMonths != null) {
    if (projections.runwayMonths < 12) {
      notes.push({ level: "warn", text: `At this burn, your runway is ~${projections.runwayMonths} months — under 12. Investors prefer 18+. Consider a larger raise or lower burn.` });
    } else if (projections.runwayMonths < 18) {
      notes.push({ level: "info", text: `Runway is ~${projections.runwayMonths} months. 18+ gives more negotiating leverage.` });
    }
  }

  return notes;
}
