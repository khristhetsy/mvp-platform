/**
 * Odoo project stage bar for one IR project.
 *   GET  ?odooProjectId=  → { stage, status, projects, projectId } or { linked: false }
 *   POST { odooProjectId, field, value } → writes the stage (or status) to Odoo, then
 *        returns the fresh bar. Same as clicking the step in Odoo.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { irStaff, forbidden, failed } from "@/lib/ir/auth";
import { loadOdooProjectStage, setOdooProjectStage } from "@/lib/ir/odoo-project-stage";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!(await irStaff())) return forbidden();
  const { id } = await ctx.params;
  const wanted = Number(req.nextUrl.searchParams.get("odooProjectId"));
  try {
    const bar = await loadOdooProjectStage(id, Number.isFinite(wanted) && wanted > 0 ? wanted : null);
    return NextResponse.json(bar ? { linked: true, ...bar } : { linked: false });
  } catch {
    // Odoo unreachable: the page still works, the bar just doesn't show.
    return NextResponse.json({ linked: false, odooError: true });
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!(await irStaff())) return forbidden();
  const { id } = await ctx.params;
  const p = z
    .object({ odooProjectId: z.number().int().positive(), field: z.string().min(1).max(80), value: z.string().min(1).max(80) })
    .safeParse(await req.json().catch(() => ({})));
  if (!p.success) return NextResponse.json({ error: "Pick a stage." }, { status: 400 });
  try {
    await setOdooProjectStage(id, p.data.odooProjectId, p.data.field, p.data.value);
    const bar = await loadOdooProjectStage(id, p.data.odooProjectId);
    return NextResponse.json(bar ? { linked: true, ...bar } : { linked: false });
  } catch (e) {
    return failed(e, "Couldn't update the stage in Odoo.");
  }
}
