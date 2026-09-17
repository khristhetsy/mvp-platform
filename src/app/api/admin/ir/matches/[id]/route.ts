/**
 * One investor on one project (Share Project record).
 *   GET   → { match, project, activities, notes, stageEvents, alsoMatched, staff, investor }
 *   PATCH { stage?, assigneeId?, starred?, founderVisible?, termSheetReceivedAt?, taskId? } → { ok }
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { irStaff, forbidden, failed } from "@/lib/ir/auth";
import { alsoMatched, db, getMatch, getProject, listActivities, listNotes, listStaff, listStageEvents, updateMatch } from "@/lib/ir/db";
import { IR_STAGES } from "@/lib/ir/types";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!(await irStaff())) return forbidden();
  const { id } = await ctx.params;
  try {
    const match = await getMatch(id);
    if (!match) return NextResponse.json({ error: "Match not found." }, { status: 404 });
    const [project, activities, notes, stageEvents, also, staff, inv] = await Promise.all([
      getProject(match.project_id), listActivities({ matchId: id }), listNotes({ matchId: id }), listStageEvents(id), alsoMatched(match.investor_contact_id, id), listStaff(),
      // Investor profile for the tab — no phone / email here; the Sales Hub contact page enforces its own permissions.
      db().from("crm_contacts").select("id, name, company, country, inv_source, inv_verified_at, profile").eq("id", match.investor_contact_id).maybeSingle(),
    ]);
    const c = (inv.data ?? null) as { id: string; name: string | null; company: string | null; country: string | null; inv_source: string | null; inv_verified_at: string | null; profile: Record<string, unknown> | null } | null;
    const investor = c ? { id: c.id, name: c.name, firm: c.company, country: c.country, dataSource: c.inv_source, verifiedAt: c.inv_verified_at, investorTypes: (c.profile?.investorTypes as string[] | undefined) ?? [], industries: (c.profile?.industries as string[] | undefined) ?? [] } : null;
    return NextResponse.json({ match, project, activities, notes, stageEvents, alsoMatched: also, staff, investor });
  } catch (e) { return failed(e, "Couldn't load the record."); }
}

const schema = z.object({
  stage: z.enum(IR_STAGES).optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  starred: z.boolean().optional(),
  founderVisible: z.boolean().optional(),
  termSheetReceivedAt: z.string().datetime().nullable().optional(),
  taskId: z.string().uuid().nullable().optional(),
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const profile = await irStaff();
  if (!profile) return forbidden();
  const { id } = await ctx.params;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid update." }, { status: 400 });
  const d = parsed.data;
  try {
    await updateMatch(id, { stage: d.stage, assignee_id: d.assigneeId, starred: d.starred, founder_visible: d.founderVisible, term_sheet_received_at: d.termSheetReceivedAt, task_id: d.taskId }, profile.id);
    return NextResponse.json({ ok: true });
  } catch (e) { return failed(e, "Couldn't update the record."); }
}
