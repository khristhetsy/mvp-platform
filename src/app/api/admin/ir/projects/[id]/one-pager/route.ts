/**
 * The founder's published one-pager for an IR project, for the email dialog's attachment row.
 *   GET → { onePager: { url, companyName } | null }  (null when the company has none published)
 */
import { NextRequest, NextResponse } from "next/server";
import { irStaff, forbidden, failed } from "@/lib/ir/auth";
import { getProject } from "@/lib/ir/db";
import { onePagerFor } from "@/lib/ir/send-email";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!(await irStaff())) return forbidden();
  const { id } = await ctx.params;
  try {
    const project = await getProject(id);
    if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    return NextResponse.json({ onePager: await onePagerFor(project.company_id) });
  } catch (e) { return failed(e, "Couldn't load the one-pager."); }
}
