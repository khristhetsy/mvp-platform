/**
 * Goals for one period (firm-wide row + one row per active project, per metric).
 *   GET ?kind=week|month&start=YYYY-MM-DD → { period, projects, rows: [{projectId|null, metric, target}] }
 *   PUT { kind, start, rows: [{projectId|null, metric, target|null}] } → { ok }   (null target removes the goal)
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { irStaff, forbidden, failed } from "@/lib/ir/auth";
import { listGoals, listProjects, saveGoals } from "@/lib/ir/db";
import { GOAL_METRICS, periodFor, periodLabel, type PeriodKind } from "@/lib/ir/metrics";

export const dynamic = "force-dynamic";
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: NextRequest): Promise<Response> {
  if (!(await irStaff())) return forbidden();
  const sp = req.nextUrl.searchParams;
  const kind: PeriodKind = sp.get("kind") === "week" ? "week" : "month";
  const start = sp.get("start");
  if (!start || !DAY.test(start)) return NextResponse.json({ error: "start must be YYYY-MM-DD." }, { status: 400 });
  const period = periodFor(kind, start);
  try {
    const [projects, goals] = await Promise.all([listProjects({ status: "active" }), listGoals({ kind, from: period.start, to: period.end })]);
    const rows = goals.filter((g) => g.period_start === period.start && !g.assignee_id).map((g) => ({ projectId: g.project_id, metric: g.metric, target: Number(g.target) }));
    return NextResponse.json({ period: { kind, ...period, label: periodLabel(kind, period) }, projects: projects.map((p) => ({ id: p.id, title: p.title })), rows });
  } catch (e) { return failed(e, "Couldn't load goals."); }
}

const schema = z.object({
  kind: z.enum(["week", "month"]),
  start: z.string().regex(DAY),
  rows: z.array(z.object({ projectId: z.string().uuid().nullable(), metric: z.enum(GOAL_METRICS), target: z.number().min(0).max(100000).nullable() })).max(500),
});

export async function PUT(req: NextRequest): Promise<Response> {
  const me = await irStaff();
  if (!me) return forbidden();
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid goals." }, { status: 400 });
  const period = periodFor(parsed.data.kind, parsed.data.start);
  try {
    await saveGoals({ kind: parsed.data.kind, start: period.start, end: period.end, rows: parsed.data.rows, by: me.id });
    return NextResponse.json({ ok: true });
  } catch (e) { return failed(e, "Couldn't save goals."); }
}
