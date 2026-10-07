/**
 * Stages for one IR project's Tasks board.
 *   GET  → { stages: [{ id, name, sequence }], byTask: { [irTaskId]: odooStageId }, local: [{ id, name, sequence }] }
 *   POST { name } → { stage: { id, name, sequence } }  (adds an iCapOS stage; nothing is written to Odoo)
 * `stages` / `byTask` are the Odoo stages of the project's imported tasks (read-only, live from Odoo),
 * so "Group by: Stage" columns match the Odoo kanban. `local` are the stages staff added with
 * "+ Stage" on the board. Odoo degrades to empty lists when unreachable or when the project has
 * no imported tasks; `local` degrades to [] before migration 20261007230000 is applied.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { irStaff, forbidden, failed } from "@/lib/ir/auth";
import { db } from "@/lib/ir/db";
import { executeKw, odooConfigured } from "@/lib/crm-connectors/odoo/client";

export const dynamic = "force-dynamic";

type Many2one = [number, string] | false;
type Stage = { id: number; name: string; sequence: number };
type LocalStage = { id: string; name: string; sequence: number };

async function localStages(projectId: string): Promise<LocalStage[]> {
  const { data, error } = await db().from("ir_task_stages").select("id, name, sequence").eq("project_id", projectId).order("sequence").order("created_at");
  return error ? [] : ((data ?? []) as LocalStage[]);
}

async function odooStages(projectId: string): Promise<{ stages: Stage[]; byTask: Record<string, number>; odooError?: true }> {
  try {
    const { data } = await db().from("ir_tasks").select("id, odoo_task_id").eq("project_id", projectId).not("odoo_task_id", "is", null);
    const tasks = (data ?? []) as Array<{ id: string; odoo_task_id: number }>;
    if (!tasks.length || !odooConfigured()) return { stages: [], byTask: {} };
    const rows = await executeKw<Array<{ id: number; stage_id: Many2one }>>("project.task", "search_read",
      [[["id", "in", tasks.map((t) => t.odoo_task_id)]]], { fields: ["stage_id"], context: { active_test: false } });
    const stageOf = new Map(rows.map((r) => [r.id, r.stage_id ? r.stage_id[0] : null]));
    const stageIds = [...new Set(rows.map((r) => (r.stage_id ? r.stage_id[0] : null)).filter((x): x is number => x != null))];
    const stages = stageIds.length
      ? await executeKw<Stage[]>("project.task.type", "read", [stageIds], { fields: ["name", "sequence"] })
      : [];
    stages.sort((a, b) => a.sequence - b.sequence || a.id - b.id);
    const byTask: Record<string, number> = {};
    for (const t of tasks) { const s = stageOf.get(t.odoo_task_id); if (s != null) byTask[t.id] = s; }
    return { stages: stages.map((s) => ({ id: s.id, name: s.name, sequence: s.sequence })), byTask };
  } catch {
    return { stages: [], byTask: {}, odooError: true };
  }
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!(await irStaff())) return forbidden();
  const { id } = await ctx.params;
  const [odoo, local] = await Promise.all([odooStages(id), localStages(id).catch(() => [])]);
  return NextResponse.json({ ...odoo, local });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const me = await irStaff();
  if (!me) return forbidden();
  const { id } = await ctx.params;
  const p = z.object({ name: z.string().trim().min(1).max(80) }).safeParse(await req.json().catch(() => ({})));
  if (!p.success) return NextResponse.json({ error: "Name the stage." }, { status: 400 });
  try {
    const existing = await localStages(id);
    if (existing.some((s) => s.name.toLowerCase() === p.data.name.toLowerCase())) return NextResponse.json({ error: "That stage already exists." }, { status: 409 });
    const sequence = existing.reduce((m, s) => Math.max(m, s.sequence), 0) + 10;
    const { data, error } = await db().from("ir_task_stages").insert({ project_id: id, name: p.data.name, sequence, created_by: me.id }).select("id, name, sequence").single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ stage: data as LocalStage });
  } catch (e) { return failed(e, "Couldn't add the stage."); }
}
