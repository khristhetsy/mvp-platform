/**
 * Recover Odoo activity history (calls, emails, meetings, term sheets) onto an imported project.
 *   GET  ?project=<id>        → ResyncResult, dry run: reads Odoo, writes nothing
 *   POST { projectId }        → ResyncResult, applies it (idempotent, safe to re-run)
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { irStaff, forbidden, failed } from "@/lib/ir/auth";
import { resyncProject } from "@/lib/ir/odoo-resync";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest): Promise<Response> {
  const me = await irStaff();
  if (!me) return forbidden();
  const projectId = req.nextUrl.searchParams.get("project");
  if (!projectId) return NextResponse.json({ error: "Pick a project." }, { status: 400 });
  try { return NextResponse.json(await resyncProject(projectId, me.id, true)); } catch (e) { return failed(e, "Couldn't read from Odoo."); }
}

const schema = z.object({ projectId: z.string().uuid() });

export async function POST(req: NextRequest): Promise<Response> {
  const me = await irStaff();
  if (!me) return forbidden();
  const p = schema.safeParse(await req.json().catch(() => ({})));
  if (!p.success) return NextResponse.json({ error: "Pick a project." }, { status: 400 });
  try { return NextResponse.json(await resyncProject(p.data.projectId, me.id, false)); } catch (e) { return failed(e, "Couldn't recover the history."); }
}
