/**
 * Recover Odoo activity history onto projects that were already imported.
 *
 * The first import kept an Agent Field entry only when it named one investor AND had a
 * date, and re-runs skip investors already on the project, so tasks carrying many
 * investors came through with stages but no activity. This pass re-reads Odoo
 * (read-only) and, for every dated entry on an imported task:
 *   - names an investor on the task → activity on that investor's record
 *   - names no one               → activity on the task (counts on the dashboard,
 *                                   shows on the task, not on any one investor)
 * Idempotent: an entry already present (same task, investor, type, date and text) is
 * skipped, so it can run again after new Odoo notes. Undated entries and plain notes
 * are reported, never guessed. `dryRun` returns the plan without writing.
 */
import { db, updateMatch } from "@/lib/ir/db";
import { discover, inferStage, odooTasks, taskEntries, type OdooTaskLite } from "@/lib/ir/odoo-import";
import { IR_STAGES, type IrStage } from "@/lib/ir/types";

export type ResyncActivity = { taskId: string; matchId: string | null; type: string; subject: string; outcome: string; date: string; assigneeId: string | null };
export type ResyncCounts = { email: number; call: number; voicemail: number; meeting: number; term_sheet: number; document: number };
export type ResyncResult = {
  projectId: string; dryRun: boolean;
  odooTasks: number; tasksWithNotes: number; entries: number;
  toAdd: ResyncCounts & { total: number; onInvestor: number; onTask: number };
  alreadyPresent: number; skippedUndated: number; skippedNotes: number; tasksNotImported: number;
  stagesAdvanced: number; sample: Array<{ date: string; type: string; outcome: string; investor: string | null }>;
};

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 200);
export const activityKey = (a: { taskId: string | null; matchId: string | null; type: string; date: string; outcome: string }) =>
  `${a.taskId ?? ""}|${a.matchId ?? ""}|${a.type}|${a.date}|${norm(a.outcome)}`;

type IrTask = { id: string; odoo_task_id: number; assignee_id: string | null };
type IrMatch = { id: string; odoo_tag: string | null; stage: IrStage };

/** Pure: what the pass would add, given Odoo tasks and what the IR Hub already holds. */
export function planResync(tasks: Array<Pick<OdooTaskLite, "id" | "tags" | "agentText">>, irTasks: IrTask[], matches: IrMatch[], existingKeys: Set<string>) {
  const byOdoo = new Map(irTasks.map((t) => [t.odoo_task_id, t]));
  const byTag = new Map(matches.filter((m) => m.odoo_tag).map((m) => [m.odoo_tag as string, m]));
  const seen = new Set(existingKeys);
  const add: Array<ResyncActivity & { investor: string | null }> = [];
  const stageEntries = new Map<string, Array<{ type: ResyncActivity["type"] & string; outcome: string; subject: string }>>();
  let entries = 0, tasksWithNotes = 0, already = 0, undated = 0, notes = 0, notImported = 0;
  for (const t of tasks) {
    const es = taskEntries(t as OdooTaskLite);
    if (es.length) tasksWithNotes++;
    entries += es.length;
    const ir = byOdoo.get(t.id);
    if (!ir) { if (es.length) notImported++; continue; }
    for (const e of es) {
      if (e.type === "note") { notes++; continue; }
      if (!e.date) { undated++; continue; }
      const match = e.investorKey ? byTag.get(e.investorKey) ?? null : null;
      const a: ResyncActivity = { taskId: ir.id, matchId: match?.id ?? null, type: e.type, subject: e.subject, outcome: e.outcome.slice(0, 2000), date: e.date, assigneeId: ir.assignee_id };
      const k = activityKey(a);
      if (seen.has(k)) { already++; continue; }
      seen.add(k);
      add.push({ ...a, investor: match ? e.investorKey : null });
      if (match) stageEntries.set(match.id, [...(stageEntries.get(match.id) ?? []), { type: e.type, outcome: e.outcome, subject: e.subject }]);
    }
  }
  const stageMoves: Array<{ matchId: string; to: IrStage }> = [];
  for (const m of matches) {
    const es = stageEntries.get(m.id); if (!es) continue;
    const to = inferStage(es as Parameters<typeof inferStage>[0]);
    if (m.stage !== "passed" && IR_STAGES.indexOf(to) > IR_STAGES.indexOf(m.stage)) stageMoves.push({ matchId: m.id, to });
  }
  return { add, stageMoves, entries, tasksWithNotes, already, undated, notes, notImported };
}

export async function resyncProject(projectId: string, by: string, dryRun = true): Promise<ResyncResult> {
  const { data: p } = await db().from("ir_projects").select("id, odoo_project_ids").eq("id", projectId).single();
  const ids = ((p as { odoo_project_ids: number[] | null } | null)?.odoo_project_ids) ?? [];
  if (!ids.length) throw new Error("This project was not imported from Odoo.");
  const d = await discover();
  if (!d.configured) throw new Error("Odoo isn't configured on this environment.");
  const [tasks, tRes, mRes, aRes] = await Promise.all([
    odooTasks(ids, d, d.agentField),
    db().from("ir_tasks").select("id, odoo_task_id, assignee_id").eq("project_id", projectId).not("odoo_task_id", "is", null),
    db().from("ir_matches").select("id, odoo_tag, stage").eq("project_id", projectId),
    db().from("ir_activities").select("task_id, match_id, type, done_at, outcome").eq("project_id", projectId).not("done_at", "is", null).limit(50000),
  ]);
  const existing = new Set(((aRes.data ?? []) as Array<{ task_id: string | null; match_id: string | null; type: string; done_at: string; outcome: string | null }>)
    .map((a) => activityKey({ taskId: a.task_id, matchId: a.match_id, type: a.type, date: a.done_at.slice(0, 10), outcome: a.outcome ?? "" })));
  const plan = planResync(tasks, (tRes.data ?? []) as IrTask[], (mRes.data ?? []) as IrMatch[], existing);

  const counts: ResyncCounts = { email: 0, call: 0, voicemail: 0, meeting: 0, term_sheet: 0, document: 0 };
  for (const a of plan.add) if (a.type in counts) counts[a.type as keyof ResyncCounts]++;
  const result: ResyncResult = {
    projectId, dryRun, odooTasks: tasks.length, tasksWithNotes: plan.tasksWithNotes, entries: plan.entries,
    toAdd: { ...counts, total: plan.add.length, onInvestor: plan.add.filter((a) => a.matchId).length, onTask: plan.add.filter((a) => !a.matchId).length },
    alreadyPresent: plan.already, skippedUndated: plan.undated, skippedNotes: plan.notes, tasksNotImported: plan.notImported,
    stagesAdvanced: plan.stageMoves.length,
    sample: plan.add.slice(0, 12).map((a) => ({ date: a.date, type: a.type, outcome: a.outcome.slice(0, 120), investor: a.investor })),
  };
  if (dryRun || !plan.add.length) return result;

  for (let i = 0; i < plan.add.length; i += 500) {
    const rows = plan.add.slice(i, i + 500).map((a) => ({
      project_id: projectId, match_id: a.matchId, task_id: a.taskId, type: a.type, subject: a.subject, outcome: a.outcome,
      done_at: `${a.date}T12:00:00Z`, created_at: `${a.date}T12:00:00Z`, assignee_id: a.assigneeId ?? by, created_by: by, founder_visible: true,
    }));
    const { error } = await db().from("ir_activities").insert(rows);
    if (error) throw new Error(`Couldn't add activities: ${error.message}`);
  }
  for (const s of plan.stageMoves) await updateMatch(s.matchId, { stage: s.to }, by);
  return result;
}
