/**
 * The founder's published one-pager for an IR project, for the email dialog's attachment row.
 *   GET → { onePager: { url, companyName } | null, linked: boolean, suggestions: [{ id, name }] }
 *   onePager is null when the company has none published. When the project isn't linked to a
 *   company yet, `suggestions` are companies whose name carries the founder's last name or a
 *   word of the project title, so the dialog can offer a one-click link.
 */
import { NextRequest, NextResponse } from "next/server";
import { irStaff, forbidden, failed } from "@/lib/ir/auth";
import { db, getProject } from "@/lib/ir/db";
import { onePagerFor } from "@/lib/ir/send-email";

export const dynamic = "force-dynamic";

async function suggestCompanies(founderName: string | null, title: string): Promise<Array<{ id: string; name: string }>> {
  const stop = new Set(["the", "and", "inc", "llc", "week", "month", "project", "founder"]);
  const words = [...new Set([founderName?.trim().split(/\s+/).pop() ?? "", ...title.split(/[^A-Za-z0-9]+/)].map((w) => w.toLowerCase()).filter((w) => w.length >= 4 && !stop.has(w)))].slice(0, 3);
  if (!words.length) return [];
  const { data } = await db().from("companies").select("id, company_name").or(words.map((w) => `company_name.ilike.%${w}%`).join(",")).limit(5);
  return ((data ?? []) as Array<{ id: string; company_name: string | null }>).map((c) => ({ id: c.id, name: c.company_name ?? "Company" }));
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!(await irStaff())) return forbidden();
  const { id } = await ctx.params;
  try {
    const project = await getProject(id);
    if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    const linked = !!project.company_id;
    return NextResponse.json({
      onePager: await onePagerFor(project.company_id),
      linked,
      suggestions: linked ? [] : await suggestCompanies(project.founder_name, project.title),
    });
  } catch (e) { return failed(e, "Couldn't load the one-pager."); }
}
