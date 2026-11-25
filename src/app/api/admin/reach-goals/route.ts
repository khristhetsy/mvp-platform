import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePermissionApi } from "@/lib/api/permissions";
import { writeAuditLog } from "@/lib/data/audit";
import { REACH_GOAL_MAX } from "@/lib/admin/reach-goals";
import { getReachGoals, setReachGoals } from "@/lib/settings/platform-settings";

export const dynamic = "force-dynamic";

/** GET: the reach goals set on Feature Controls. A null field means no goal. */
export async function GET() {
  const auth = await requirePermissionApi("manage_settings");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json({ goals: await getReachGoals() });
}

const goal = z.number().int().min(1).max(REACH_GOAL_MAX).nullable();
const goalSet = z.object({ sentWeek: goal, openedWeek: goal, sentMonth: goal, openedMonth: goal });
const putSchema = z.object({ intro: goalSet, auto: goalSet });

export async function PUT(req: NextRequest): Promise<Response> {
  const auth = await requirePermissionApi("manage_settings");
  if ("error" in auth) return auth.error ?? NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = putSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: `Each goal is a whole number from 1 to ${REACH_GOAL_MAX.toLocaleString("en-US")}, or empty for no goal.` }, { status: 400 });

  const saved = await setReachGoals(parsed.data, auth.userId);
  if (!saved) return NextResponse.json({ error: "Could not save reach goals." }, { status: 500 });

  await writeAuditLog(auth.userSupabase, {
    userId: auth.userId,
    action: "admin.reach_goals_updated",
    entityType: "platform_settings",
    entityId: "reach_goals",
    metadata: { goals: saved },
  });

  return NextResponse.json({ success: true, goals: saved });
}
