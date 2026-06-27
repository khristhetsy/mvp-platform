// Monthly financial-model expansion. Reuses the SAME per-month math as
// computeProjections (business plan) so the annual totals tie out exactly.
// Pure + deterministic — the founder supplies drivers, code does the math.

import type { ProjectionAssumptions } from "@/lib/business-plan/projections";

export interface MonthlyRow {
  month: number; // 1..36
  year: number; // 1..3
  customers: number;
  revenue: number;
  grossProfit: number;
  operatingExpense: number;
  netCashFlow: number;
  cashBalance: number;
}

function round(n: number): number {
  return Math.round(n);
}

/** 36-month projection, one row per month, with a running cash balance. */
export function computeMonthlyModel(a: ProjectionAssumptions): MonthlyRow[] {
  const g = a.monthlyGrowthPct / 100;
  const margin = a.grossMarginPct / 100;
  const months = 36;

  const rows: MonthlyRow[] = [];
  let cash = a.raiseAmount;

  for (let m = 0; m < months; m++) {
    const customers = a.startingCustomers * Math.pow(1 + g, m);
    const revenue = customers * a.pricePerMonth;
    const grossProfit = revenue * margin;
    const net = grossProfit - a.monthlyBurn;
    cash += net;

    rows.push({
      month: m + 1,
      year: Math.floor(m / 12) + 1,
      customers: round(customers),
      revenue: round(revenue),
      grossProfit: round(grossProfit),
      operatingExpense: round(a.monthlyBurn),
      netCashFlow: round(net),
      cashBalance: round(cash),
    });
  }

  return rows;
}
