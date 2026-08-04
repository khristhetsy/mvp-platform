// Resolves the numeric chart data the deck's slides draw, reusing the founder's
// business plan (projections + AI-parsed charts).
import { normalizeCharts, type PlanCharts } from "@/lib/business-plan/charts";
import type { BusinessPlan } from "@/lib/business-plan/types";

export interface DeckChartData {
  projections: { revenue: number; grossProfit: number }[];
  allocation: PlanCharts["allocation"];
  market: PlanCharts["market"];
  problem: PlanCharts["problem"];
  solution: PlanCharts["solution"];
  competition: PlanCharts["competition"];
  traction: PlanCharts["traction"];
}

export function deckChartData(plan: BusinessPlan | null): DeckChartData {
  const charts = normalizeCharts(plan?.charts);
  const years = (plan?.projections?.years ?? []).slice(0, 3).map((y) => ({ revenue: y.revenue, grossProfit: y.grossProfit }));
  return {
    projections: years,
    allocation: charts.allocation,
    market: charts.market,
    problem: charts.problem,
    solution: charts.solution,
    competition: charts.competition,
    traction: charts.traction,
  };
}
