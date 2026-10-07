/**
 * Archive, unarchive, delete Investor Relations tasks (one or many).
 *   POST { ids, action: "preview" }   → { tasks, investors, activities, odooLinked }
 *   POST { ids, action: "archive" | "unarchive" | "delete" } → { ok, count, odooFailed }
 * Tasks linked to Odoo are archived (or restored) in Odoo too, so the next Odoo import
 * doesn't bring a deleted or archived task back. Delete removes the task's investors and
 * their activities; archive keeps everything.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { irStaff, forbidden, failed } from "@/lib/ir/auth";
import { db, deleteTasks, setTasksArchived, taskImpact } from "@/lib/ir/db";
import { setOdooTasksActive } from "@/lib/ir/odoo-task-archive";

export const dynamic = "force-dynamic";

const schema = z.object({ ids: z.array(z.string().uuid()).min(1).max(500), action: z.enum(["preview", "archive", "unarchive", "delete"]) });

export async function POST(req: NextRequest): Promise<Response> {
  if (!(await irStaff())) return forbidden();
  const p = schema.safeParse(await req.json().catch(() => ({})));
  if (!p.success) return NextResponse.json({ error: "Pick at least one task." }, { status: 400 });
  const ids = [...new Set(p.data.ids)];
  try {
    if (p.data.action === "preview") return NextResponse.json(await taskImpact(ids));
    const { data } = await db().from("ir_tasks").select("id, odoo_task_id").in("id", ids);
    const rows = (data ?? []) as Array<{ id: string; odoo_task_id: number | null }>;
    if (!rows.length) return NextResponse.json({ error: "Task not found." }, { status: 404 });
    const found = rows.map((r) => r.id);
    const odooIds = rows.map((r) => r.odoo_task_id).filter((n): n is number => n != null);
    const { failed: odooFailed } = await setOdooTasksActive(odooIds, p.data.action === "unarchive");
    if (p.data.action === "delete") await deleteTasks(found);
    else await setTasksArchived(found, p.data.action === "archive");
    return NextResponse.json({ ok: true, count: found.length, odooFailed });
  } catch (e) { return failed(e, "Couldn't update the tasks."); }
}
