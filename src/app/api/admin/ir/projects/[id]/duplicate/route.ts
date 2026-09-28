/**
 * Duplicate an IR project: same founder, owner, term and settings, fresh month / week
 * milestones, and a copy of each week task (title, assignee, deadline) on the matching
 * week. Investors, activities and notes are not copied.
 *   POST → { id }
 */
import { NextRequest, NextResponse } from "next/server";
import { irStaff, forbidden, failed } from "@/lib/ir/auth";
import { createProject, db, getProject, listMilestones, listTasks } from "@/lib/ir/db";

export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const me = await irStaff();
  if (!me) return forbidden();
  const { id } = await ctx.params;
  try {
    const p = await getProject(id);
    if (!p) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    const { id: copyId } = await createProject({
      companyId: p.company_id, title: `${p.title} (copy)`.slice(0, 160), founderName: p.founder_name, founderContactId: p.founder_contact_id, ownerId: p.owner_id,
      sourceOpportunityId: null, startDate: p.start_date, termMonths: p.term_months, founderReportVisible: p.founder_report_visible, isSpv: p.is_spv, createdBy: me.id,
    });
    const [oldWeeks, newWeeks, tasks] = await Promise.all([listMilestones(id), listMilestones(copyId), listTasks(id)]);
    // Same start and term, so weeks line up by sort order.
    const bySort = new Map(newWeeks.filter((w) => w.kind === "week").map((w) => [w.sort_order, w.id]));
    const weekOf = new Map(oldWeeks.filter((w) => w.kind === "week").map((w) => [w.id, bySort.get(w.sort_order) ?? null]));
    const rows = tasks.map((t) => ({ project_id: copyId, milestone_id: weekOf.get(t.milestone_id), title: t.title, assignee_id: t.assignee_id, deadline: t.deadline })).filter((r) => r.milestone_id);
    if (rows.length) {
      const { error } = await db().from("ir_tasks").insert(rows);
      if (error) throw new Error(error.message);
    }
    return NextResponse.json({ id: copyId, tasks: rows.length });
  } catch (e) { return failed(e, "Couldn't duplicate the project."); }
}
