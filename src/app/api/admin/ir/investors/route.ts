/**
 * Investor lookup for "Add matches" — name / firm / data source only, never phone or email.
 *   GET ?q=<text>&project=<id> → { investors: [{ id, name, firm, dataSource, alsoOn: [project titles], onThisProject }] }
 */
import { NextRequest, NextResponse } from "next/server";
import { irStaff, forbidden, failed } from "@/lib/ir/auth";
import { db } from "@/lib/ir/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
  if (!(await irStaff())) return forbidden();
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  const projectId = req.nextUrl.searchParams.get("project");
  if (q.length < 2) return NextResponse.json({ investors: [] });
  try {
    const like = `%${q.replace(/[%_,]/g, " ")}%`;
    const { data, error } = await db().from("crm_contacts").select("id, name, company, inv_source")
      .eq("contact_type", "investor").or(`name.ilike.${like},company.ilike.${like}`).order("name").limit(30);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as Array<{ id: string; name: string | null; company: string | null; inv_source: string | null }>;
    const ids = rows.map((r) => r.id);
    const { data: m } = ids.length ? await db().from("ir_matches").select("investor_contact_id, project_id, project:ir_projects(title)").in("investor_contact_id", ids) : { data: [] };
    const also = new Map<string, string[]>(); const here = new Set<string>();
    for (const x of (m ?? []) as Array<{ investor_contact_id: string; project_id: string; project: { title: string } | null }>) {
      if (projectId && x.project_id === projectId) here.add(x.investor_contact_id);
      else also.set(x.investor_contact_id, [...(also.get(x.investor_contact_id) ?? []), x.project?.title ?? "Project"]);
    }
    return NextResponse.json({ investors: rows.map((r) => ({ id: r.id, name: r.name, firm: r.company, dataSource: r.inv_source, alsoOn: also.get(r.id) ?? [], onThisProject: here.has(r.id) })) });
  } catch (e) { return failed(e, "Couldn't search investors."); }
}
