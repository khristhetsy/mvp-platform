/**
 * Column actions for the Tasks board gear menu. Same behavior as /api/admin/ir/tasks/bulk, but only for
 * people the gear menu is shown to (Super Admin, Manager or higher, Investor Relations department).
 *   POST { action: "preview" | "archive" | "delete", ids }                      → same as bulk
 *   POST { action: "unarchive", projectId, scope: "month" | "project" | "loose", monthId? }
 *        → restores the archived tasks of that column: { ok, count }
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { irStaff, failed } from "@/lib/ir/auth";
import { canUseIrColumnMenu } from "@/lib/ir/column-access";
import { db } from "@/lib/ir/db";
import { POST as bulk } from "../bulk/route";

export const dynamic = "force-dynamic";

const idsBody = z.object({ action: z.enum(["preview", "archive", "delete"]), ids: z.array(z.string().uuid()).min(1).max(500) });
const restoreBody = z.object({ action: z.literal("unarchive"), projectId: z.string().uuid(), scope: z.enum(["month", "project", "loose"]), monthId: z.string().uuid().nullish() });

async function archivedIdsIn(projectId: string, scope: "month" | "project" | "loose", monthId: string | null | undefined): Promise<string[]> {
  const { data: ms, error } = await db().from("ir_milestones").select("id, parent_id").eq("project_id", projectId).eq("kind", "week");
  if (error) throw new Error(error.message);
  const weeks = ((ms ?? []) as Array<{ id: string; parent_id: string | null }>)
    .filter((w) => scope === "project" || (scope === "month" ? w.parent_id === monthId : !w.parent_id))
    .map((w) => w.id);
  if (!weeks.length) return [];
  const { data, error: e2 } = await db().from("ir_tasks").select("id").eq("project_id", projectId).not("archived_at", "is", null).in("milestone_id", weeks);
  if (e2) throw new Error(e2.message);
  return ((data ?? []) as Array<{ id: string }>).map((t) => t.id);
}

export async function POST(req: NextRequest): Promise<Response> {
  const me = await irStaff();
  if (!me || !(await canUseIrColumnMenu(me.id))) return NextResponse.json({ error: "Your role can't change columns." }, { status: 403 });
  const raw = await req.clone().json().catch(() => ({}));
  const restore = restoreBody.safeParse(raw);
  if (restore.success) {
    const d = restore.data;
    if (d.scope === "month" && !d.monthId) return NextResponse.json({ error: "Pick a month." }, { status: 400 });
    try {
      const ids = await archivedIdsIn(d.projectId, d.scope, d.monthId);
      if (!ids.length) return NextResponse.json({ ok: true, count: 0 });
      return bulk(new NextRequest(req.url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids, action: "unarchive" }) }));
    } catch (e) { return failed(e, "Couldn't restore the tasks."); }
  }
  if (!idsBody.safeParse(raw).success) return NextResponse.json({ error: "Pick at least one task." }, { status: 400 });
  return bulk(req);
}
