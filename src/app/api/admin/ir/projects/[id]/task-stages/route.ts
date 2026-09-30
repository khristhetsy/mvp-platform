/**
 * Odoo stages for one IR project's imported tasks (read-only, live from Odoo).
 *   GET → { stages: [{ id, name, sequence }], byTask: { [irTaskId]: odooStageId } }
 * Drives the Tasks board's "Group by: Stage" columns so they match the Odoo kanban.
 * Degrades to empty lists when Odoo is unreachable or the project has no imported tasks.
 */
import { NextRequest, NextResponse } from "next/server";
import { irStaff, forbidden } from "@/lib/ir/auth";
import { db } from "@/lib/ir/db";
import { executeKw, odooConfigured } from "@/lib/crm-connectors/odoo/client";

export const dynamic = "force-dynamic";

type Many2one = [number, string] | false;
const EMPTY = { stages: [], byTask: {} };

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!(await irStaff())) return forbidden();
  const { id } = await ctx.params;
  try {
    const { data } = await db().from("ir_tasks").select("id, odoo_task_id").eq("project_id", id).not("odoo_task_id", "is", null);
    const tasks = (data ?? []) as Array<{ id: string; odoo_task_id: number }>;
    if (!tasks.length || !odooConfigured()) return NextResponse.json(EMPTY);
    const rows = await executeKw<Array<{ id: number; stage_id: Many2one }>>("project.task", "search_read",
      [[["id", "in", tasks.map((t) => t.odoo_task_id)]]], { fields: ["stage_id"], context: { active_test: false } });
    const stageOf = new Map(rows.map((r) => [r.id, r.stage_id ? r.stage_id[0] : null]));
    const stageIds = [...new Set(rows.map((r) => (r.stage_id ? r.stage_id[0] : null)).filter((x): x is number => x != null))];
    const stages = stageIds.length
      ? await executeKw<Array<{ id: number; name: string; sequence: number }>>("project.task.type", "read", [stageIds], { fields: ["name", "sequence"] })
      : [];
    stages.sort((a, b) => a.sequence - b.sequence || a.id - b.id);
    const byTask: Record<string, number> = {};
    for (const t of tasks) { const s = stageOf.get(t.odoo_task_id); if (s != null) byTask[t.id] = s; }
    return NextResponse.json({ stages: stages.map((s) => ({ id: s.id, name: s.name, sequence: s.sequence })), byTask });
  } catch {
    return NextResponse.json({ ...EMPTY, odooError: true });
  }
}
