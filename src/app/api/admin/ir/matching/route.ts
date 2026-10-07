/**
 * Matching queue proposals — always in project (and usually task) context.
 *   GET ?project=<id>&task=<id>&industry=a,b&stage=&raise=&revenue=&type=&source=any|verified|self_reported&tier=any|high|medium|low
 *       &offset=0&limit=50&q=<text>&hide=1&sort=<column>&dir=asc|desc
 *     → { project, task, week, onTask, options, defaults, rows (one page), total, filtered, offset, all, contacted, thin }
 * Proposes only; confirming goes through POST /api/admin/ir/matches.
 */
import { NextRequest, NextResponse } from "next/server";
import { irStaff, forbidden, failed } from "@/lib/ir/auth";
import { getProject, getTask, listMatches, listMilestones } from "@/lib/ir/db";
import { projectDefaults, proposeMatches, queueOptions, QUEUE_PAGE, type QueueSortKey } from "@/lib/ir/matching";

export const dynamic = "force-dynamic";

const SORT_KEYS: QueueSortKey[] = ["name", "outreach", "firm", "phone", "email", "fit", "why", "sectors", "types", "source", "also"];
const list = (v: string | null) => (v ? v.split(",").map((s) => s.trim()).filter(Boolean) : []);

export async function GET(req: NextRequest): Promise<Response> {
  if (!(await irStaff())) return forbidden();
  const sp = req.nextUrl.searchParams;
  const projectId = sp.get("project");
  if (!projectId) return NextResponse.json({ error: "A project is required — open the queue from a task." }, { status: 400 });
  try {
    const project = await getProject(projectId);
    if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    const taskId = sp.get("task");
    const task = taskId ? await getTask(taskId) : null;
    if (taskId && (!task || task.project_id !== projectId)) return NextResponse.json({ error: "Task not found on this project." }, { status: 404 });
    const [options, defaults, matches, milestones] = await Promise.all([queueOptions(), projectDefaults(project.company_id, project.founder_contact_id), listMatches(projectId), listMilestones(projectId)]);
    const week = task ? milestones.find((m) => m.id === task.milestone_id) ?? null : null;
    const onTask = task ? matches.filter((m) => m.task_id === task.id).length : 0;

    const explicit = sp.has("industry");
    const filters = {
      industry: explicit ? list(sp.get("industry")) : defaults.industry ?? [],
      stage: sp.has("stage") ? list(sp.get("stage")) : defaults.stage ?? [], raise: sp.has("raise") ? list(sp.get("raise")) : defaults.raise ?? [],
      revenue: sp.has("revenue") ? list(sp.get("revenue")) : defaults.revenue ?? [], investorType: sp.has("type") ? list(sp.get("type")) : defaults.investorType ?? [],
      source: (sp.get("source") as "any" | "verified" | "self_reported") || "any", tier: (sp.get("tier") as "any" | "high" | "medium" | "low") || "any",
    };
    const sortKey = sp.get("sort") as QueueSortKey | null;
    const view = {
      offset: Math.max(0, Number(sp.get("offset")) || 0), limit: Number(sp.get("limit")) || QUEUE_PAGE,
      q: (sp.get("q") ?? "").slice(0, 100), hideContacted: sp.get("hide") === "1",
      sort: sortKey && SORT_KEYS.includes(sortKey) ? { key: sortKey, dir: sp.get("dir") === "desc" ? "desc" as const : "asc" as const } : null,
    };
    const result = await proposeMatches(projectId, filters, view);
    return NextResponse.json({ project, task, week, onTask, options, defaults, filters, ...result });
  } catch (e) { return failed(e, "Couldn't build the matching queue."); }
}
