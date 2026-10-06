import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermissionApi } from "@/lib/api/permissions";
import { deleteGoal, loadGoals, saveGoal } from "@/lib/analytics/message-activity";
import { METRIC_KEYS, toPerMonth, type GoalBasis, type MetricKey } from "@/lib/analytics/message-activity-metrics";

export const dynamic = "force-dynamic";

/**
 * Message activity goals (Admin, Analytics, Messages, Goals).
 * GET            every goal entry (view_analytics)
 * POST           set a goal from a month, or stop it (manage_reports)
 * DELETE ?id=    remove one history entry (manage_reports)
 */
export async function GET() {
  const auth = await requirePermissionApi("view_analytics");
  if ("error" in auth) return auth.error;
  const goals = await loadGoals();
  return NextResponse.json(goals);
}

const Body = z.object({
  metricKey: z.string().refine((k) => (METRIC_KEYS as string[]).includes(k), "Unknown metric."),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Choose the month the goal starts."),
  stop: z.boolean().optional(),
  amount: z.number().min(0, "Enter a goal of 0 or more.").max(1_000_000).optional(),
  basis: z.enum(["day", "week", "month", "quarter", "year"]).optional(),
  direction: z.enum(["up", "down"]),
  note: z.string().max(200).optional(),
});

export async function POST(request: Request) {
  const auth = await requirePermissionApi("manage_reports");
  if ("error" in auth) return auth.error;

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the goal and try again." }, { status: 400 });
  }
  const b = parsed.data;
  if (!b.stop && (b.amount === undefined || !b.basis)) {
    return NextResponse.json({ error: "Enter a goal of 0 or more." }, { status: 400 });
  }

  const goals = await loadGoals();
  if (goals.tableMissing) {
    return NextResponse.json({ error: "Goals can't be saved until the message_activity_goals migration is applied." }, { status: 409 });
  }

  await saveGoal(
    {
      metricKey: b.metricKey as MetricKey,
      month: b.month,
      perMonth: b.stop ? null : toPerMonth(b.amount as number, b.basis as GoalBasis),
      amount: b.stop ? null : (b.amount as number),
      basis: b.stop ? null : (b.basis as GoalBasis),
      direction: b.direction,
      note: b.note?.trim() || null,
    },
    auth.userId,
  );
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const auth = await requirePermissionApi("manage_reports");
  if ("error" in auth) return auth.error;
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Not found." }, { status: 404 });
  await deleteGoal(id);
  return NextResponse.json({ ok: true });
}
