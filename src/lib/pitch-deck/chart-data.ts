// Resolves the numeric chart data the deck's Financials/Market/Ask slides draw,
// reusing the founder's business plan (projections + AI-parsed charts).
import { normalizeCharts, type PlanCharts } from "@/lib/business-plan/charts";
import type { BusinessPlan } from "@/lib/business-plan/types";

export interface DeckChartData {
  projections: { revenue: number; grossProfit: number }[];
  allocation: PlanCharts["allocation"];
  market: PlanCharts["market"];
}

export function deckChartData(plan: BusinessPlan | null): DeckChartData {
  const charts = normalizeCharts(plan?.charts);
  const years = (plan?.projections?.years ?? []).slice(0, 3).map((y) => ({ revenue: y.revenue, grossProfit: y.grossProfit }));
  return { projections: years, allocation: charts.allocation, market: charts.market };
}
