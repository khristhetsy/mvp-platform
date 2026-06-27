// Projection driver definitions + stage-appropriate starting defaults. The AI
// suggests these as a starting point; the founder confirms or overrides each.

import type { ProjectionAssumptions } from "./projections";

export interface AssumptionDef {
  key: keyof ProjectionAssumptions;
  label: string;
  help: string;
  unit: "count" | "percent" | "currency_month" | "currency";
}

export const ASSUMPTION_DEFS: AssumptionDef[] = [
  { key: "startingCustomers", label: "Starting customers", help: "Paying customers at the start of the plan.", unit: "count" },
  { key: "monthlyGrowthPct", label: "Monthly growth", help: "Expected month-over-month growth in customers.", unit: "percent" },
  { key: "pricePerMonth", label: "Price / customer", help: "Average revenue per customer per month.", unit: "currency_month" },
  { key: "grossMarginPct", label: "Gross margin", help: "Share of revenue left after cost of delivery.", unit: "percent" },
  { key: "monthlyBurn", label: "Monthly burn", help: "Total monthly operating cost.", unit: "currency_month" },
  { key: "raiseAmount", label: "Round size", help: "Amount you're raising this round.", unit: "currency" },
];

/** Stage-appropriate starting assumptions, refined by raise amount when known. */
export function defaultAssumptions(stage: string | null, raiseAmount?: number | null): ProjectionAssumptions {
  const raise = raiseAmount && raiseAmount > 0 ? raiseAmount : 1_000_000;
  switch (stage) {
    case "scaling":
      return { startingCustomers: 200, monthlyGrowthPct: 8, pricePerMonth: 500, grossMarginPct: 80, monthlyBurn: 120_000, raiseAmount: raise };
    case "growing":
      return { startingCustomers: 60, monthlyGrowthPct: 10, pricePerMonth: 450, grossMarginPct: 78, monthlyBurn: 80_000, raiseAmount: raise };
    case "early_revenue":
      return { startingCustomers: 15, monthlyGrowthPct: 12, pricePerMonth: 400, grossMarginPct: 78, monthlyBurn: 55_000, raiseAmount: raise };
    case "pre_revenue":
    default:
      return { startingCustomers: 5, monthlyGrowthPct: 12, pricePerMonth: 350, grossMarginPct: 75, monthlyBurn: 40_000, raiseAmount: raise };
  }
}
