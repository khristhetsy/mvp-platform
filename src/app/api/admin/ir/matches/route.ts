/**
 * Share Project records.
 *   GET  ?project=&stage=&assignee=&q=   → { rows, projects, staff }  every record across active projects (hub-level list)
 *   POST { projectId, taskId?, milestoneId?, investorContactIds[], assigneeId? } → { created[], skipped }
 *        confirm investors onto a project (from the matching queue or the pipeline's "Add matches").
 * Never creates a match without a project (spec 5.7).
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { irStaff, forbidden, failed } from "@/lib/ir/auth";
import { createMatches, db, getProject, getTask, listMatches, listProjects, listStaff } from "@/lib/ir/db";
import { IR_STAGES, type IrStage } from "@/lib/ir/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
  if (!(await irStaff())) return forbidden();
  const sp = req.nextUrl.searchParams;
  const projectId = sp.get("project"), stage = sp.get("stage"), assignee = sp.get("assignee"), q = (sp.get("q") ?? "").trim().toLowerCase();
  try {
    const [projects, staff] = await Promise.all([listProjects({ status: "active" }), listStaff()]);
    const scope = projectId ? projects.filter((p) => p.id === projectId) : projects;
    const perProject = await Promise.all(scope.map((p) => listMatches(p.id)));
    const title = new Map(projects.map((p) => [p.id, p.title]));
    let rows = perProject.flat().map((m) => ({ ...m, project_title: title.get(m.project_id) ?? "Project" }));
    if (stage && (IR_STAGES as readonly string[]).includes(stage)) rows = rows.filter((m) => m.stage === (stage as IrStage));
    if (assignee) rows = rows.filter((m) => m.assignee_id === assignee);
    if (q) rows = rows.filter((m) => [m.investor_name, m.investor_firm, m.project_title].some((s) => (s ?? "").toLowerCase().includes(q)));
    const ids = rows.map((m) => m.id);
    const next = new Map<string, { subject: string; due_at: string | null }>();
    for (let i = 0; i < ids.length; i += 500) {
      const { data } = await db().from("ir_activities").select("match_id, subject, due_at").in("match_id", ids.slice(i, i + 500)).is("done_at", null).order("due_at", { ascending: true, nullsFirst: false });
      for (const a of (data ?? []) as Array<{ match_id: string; subject: string; due_at: string | null }>) if (!next.has(a.match_id)) next.set(a.match_id, { subject: a.subject, due_at: a.due_at });
    }
    return NextResponse.json({ rows: rows.slice(0, 1000).map((m) => ({ ...m, next: next.get(m.id) ?? null })), total: rows.length, projects: projects.map((p) => ({ id: p.id, title: p.title })), staff });
  } catch (e) { return failed(e, "Couldn't load Share Project records."); }
}

const schema = z.object({
  projectId: z.string().uuid(),
  taskId: z.string().uuid().nullish(),
  milestoneId: z.string().uuid().nullish(),
  investorContactIds: z.array(z.string().uuid()).min(1).max(500),
  assigneeId: z.string().uuid().nullish(),
  /** From the matching queue: what the engine said about each investor at confirm time. */
  meta: z.record(z.string().uuid(), z.object({ fitTier: z.enum(["high", "medium", "low"]).nullish(), dataSource: z.string().nullish() })).optional(),
});

export async function POST(req: NextRequest): Promise<Response> {
  const profile = await irStaff();
  if (!profile) return forbidden();
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Select at least one investor." }, { status: 400 });
  const d = parsed.data;
  try {
    const project = await getProject(d.projectId);
    if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    let milestoneId = d.milestoneId ?? null;
    if (d.taskId) {
      const task = await getTask(d.taskId);
      if (!task || task.project_id !== d.projectId) return NextResponse.json({ error: "Task not found on this project." }, { status: 404 });
      milestoneId = milestoneId ?? task.milestone_id;
    }
    const fitTiers: Record<string, "high" | "medium" | "low" | null> = {}, dataSources: Record<string, string | null> = {};
    for (const [id, m] of Object.entries(d.meta ?? {})) { fitTiers[id] = m.fitTier ?? null; dataSources[id] = m.dataSource ?? null; }
    const r = await createMatches({ projectId: d.projectId, taskId: d.taskId ?? null, milestoneId, investorContactIds: d.investorContactIds, assigneeId: d.assigneeId ?? project.owner_id, createdBy: profile.id, fitTiers, dataSources });
    return NextResponse.json(r);
  } catch (e) { return failed(e, "Couldn't add the investors."); }
}
