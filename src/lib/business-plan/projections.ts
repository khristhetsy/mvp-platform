// Driver-based financial projection engine. Pure + deterministic — the founder
// supplies the assumptions, this computes the model. No AI does the math.
// Monthly simulation over 36 months, aggregated to three years + runway.

export interface ProjectionAssumptions {
  startingCustomers: number;
  monthlyGrowthPct: number; // e.g. 12 for 12%/mo
  pricePerMonth: number; // revenue per customer per month
  grossMarginPct: number; // e.g. 80
  monthlyBurn: number; // total monthly operating cost
  raiseAmount: number;
}

export interface ProjectionYear {
  year: number;
  revenue: number;
  grossProfit: number;
  operatingExpense: number;
  netCashFlow: number;
}

export interface ProjectionResult {
  years: ProjectionYear[];
  runwayMonths: number | null; // null = cash-flow positive within the window
  endingCash: number;
}

function round(n: number): number {
  return Math.round(n);
}

export function computeProjections(a: ProjectionAssumptions): ProjectionResult {
  const g = a.monthlyGrowthPct / 100;
  const margin = a.grossMarginPct / 100;
  const months = 36;

  const yearAgg: ProjectionYear[] = [0, 1, 2].map((i) => ({
    year: i + 1,
    revenue: 0,
    grossProfit: 0,
    operatingExpense: 0,
    netCashFlow: 0,
  }));

  let cash = a.raiseAmount;
  let runwayMonths: number | null = null;

  for (let m = 0; m < months; m++) {
    const customers = a.startingCustomers * Math.pow(1 + g, m);
    const revenue = customers * a.pricePerMonth;
    const grossProfit = revenue * margin;
    const net = grossProfit - a.monthlyBurn;

    cash += net;
    if (runwayMonths === null && cash < 0) runwayMonths = m + 1;

    const y = Math.floor(m / 12);
    if (y < 3) {
      yearAgg[y].revenue += revenue;
      yearAgg[y].grossProfit += grossProfit;
      yearAgg[y].operatingExpense += a.monthlyBurn;
      yearAgg[y].netCashFlow += net;
    }
  }

  const years = yearAgg.map((y) => ({
    year: y.year,
    revenue: round(y.revenue),
    grossProfit: round(y.grossProfit),
    operatingExpense: round(y.operatingExpense),
    netCashFlow: round(y.netCashFlow),
  }));

  return { years, runwayMonths, endingCash: round(cash) };
}
