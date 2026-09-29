/**
 * IR dashboard payload.
 *   GET ?period=week|month&metric=meetings_held|term_sheets|calls|emails|intros&gran=week|month&founder=<projectId|all>
 */
import { NextRequest, NextResponse } from "next/server";
import { irStaff, forbidden, failed } from "@/lib/ir/auth";
import { dashboardPayload } from "@/lib/ir/dashboard";
import { GOAL_METRICS, type GoalMetric, type PeriodKind } from "@/lib/ir/metrics";

export const dynamic = "force-dynamic";

const kind = (v: string | null, d: PeriodKind): PeriodKind => (v === "week" || v === "month" ? v : d);

export async function GET(req: NextRequest): Promise<Response> {
  if (!(await irStaff())) return forbidden();
  const sp = req.nextUrl.searchParams;
  const metric = sp.get("metric");
  const founder = sp.get("founder");
  try {
    const payload = await dashboardPayload({
      period: kind(sp.get("period"), "month"),
      trendMetric: (GOAL_METRICS as readonly string[]).includes(metric ?? "") ? (metric as GoalMetric) : "meetings_held",
      trendKind: kind(sp.get("gran"), "month"),
      founder: founder && founder !== "all" ? founder : null,
    });
    return NextResponse.json(payload);
  } catch (e) { return failed(e, "Couldn't load the dashboard."); }
}
