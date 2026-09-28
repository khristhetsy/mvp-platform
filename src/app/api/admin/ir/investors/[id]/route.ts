/**
 * One investor, for the matching queue's profile panel — name / firm / data source and every
 * IR match they are on, never phone or email.
 *   GET → { investor: { id, name, firm, dataSource, verifiedAt, website }, matches: [{ matchId, projectId, projectTitle, founderName, stage, stageChangedAt }] }
 */
import { NextRequest, NextResponse } from "next/server";
import { irStaff, forbidden, failed } from "@/lib/ir/auth";
import { db } from "@/lib/ir/db";
import type { IrStage } from "@/lib/ir/types";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!(await irStaff())) return forbidden();
  const { id } = await ctx.params;
  try {
    const [{ data: c }, { data: m }] = await Promise.all([
      db().from("crm_contacts").select("id, name, company, inv_source, inv_verified_at, website").eq("id", id).maybeSingle(),
      db().from("ir_matches").select("id, project_id, stage, stage_changed_at, project:ir_projects(title, founder_name)").eq("investor_contact_id", id).order("stage_changed_at", { ascending: false }),
    ]);
    const inv = c as { id: string; name: string | null; company: string | null; inv_source: string | null; inv_verified_at: string | null; website: string | null } | null;
    if (!inv) return NextResponse.json({ error: "Investor not found." }, { status: 404 });
    type Row = { id: string; project_id: string; stage: IrStage; stage_changed_at: string; project: { title: string; founder_name: string | null } | null };
    return NextResponse.json({
      investor: { id: inv.id, name: inv.name, firm: inv.company, dataSource: inv.inv_source, verifiedAt: inv.inv_verified_at, website: inv.website },
      matches: ((m ?? []) as Row[]).map((r) => ({ matchId: r.id, projectId: r.project_id, projectTitle: r.project?.title ?? "Project", founderName: r.project?.founder_name ?? null, stage: r.stage, stageChangedAt: r.stage_changed_at })),
    });
  } catch (e) { return failed(e, "Couldn't load the investor."); }
}
