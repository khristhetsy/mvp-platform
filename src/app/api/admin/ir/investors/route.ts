/**
 * Investor lookup for "Add matches" — name / firm / data source only, never phone or email.
 *   GET ?q=<text>&project=<id> → { investors: [{ id, name, firm, dataSource, alsoOn: [project titles], onThisProject, founderOutreach }] }
 * `founderOutreach` is the furthest stage this investor reached with the same founder on another
 * of the founder's projects (the matching queue's Outreach column), or null.
 */
import { NextRequest, NextResponse } from "next/server";
import { irStaff, forbidden, failed } from "@/lib/ir/auth";
import { db } from "@/lib/ir/db";
import { IR_STAGES, type IrStage } from "@/lib/ir/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
  if (!(await irStaff())) return forbidden();
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  const projectId = req.nextUrl.searchParams.get("project");
  if (q.length < 2) return NextResponse.json({ investors: [] });
  try {
    const like = `%${q.replace(/[%_,]/g, " ")}%`;
    const { data, error } = await db().from("crm_contacts").select("id, name, company, inv_source")
      .eq("contact_type", "investor").or(`name.ilike.${like},company.ilike.${like},email.ilike.${like}`).order("name").limit(50);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as Array<{ id: string; name: string | null; company: string | null; inv_source: string | null }>;
    const ids = rows.map((r) => r.id);
    const [{ data: m }, { data: self }] = await Promise.all([
      ids.length ? db().from("ir_matches").select("id, investor_contact_id, project_id, stage, stage_changed_at, project:ir_projects(title, company_id, founder_contact_id)").in("investor_contact_id", ids) : { data: [] },
      projectId ? db().from("ir_projects").select("company_id, founder_contact_id").eq("id", projectId).maybeSingle() : { data: null },
    ]);
    const me = self as { company_id: string | null; founder_contact_id: string | null } | null;
    const sameFounder = (p: { company_id: string | null; founder_contact_id: string | null } | null) =>
      !!p && !!me && ((!!me.company_id && p.company_id === me.company_id) || (!!me.founder_contact_id && p.founder_contact_id === me.founder_contact_id));
    const also = new Map<string, string[]>(); const here = new Set<string>();
    const prior = new Map<string, { matchId: string; stage: IrStage; stageChangedAt: string; projectTitle: string }>();
    type M = { id: string; investor_contact_id: string; project_id: string; stage: IrStage; stage_changed_at: string; project: { title: string; company_id: string | null; founder_contact_id: string | null } | null };
    for (const x of (m ?? []) as M[]) {
      if (projectId && x.project_id === projectId) { here.add(x.investor_contact_id); continue; }
      also.set(x.investor_contact_id, [...(also.get(x.investor_contact_id) ?? []), x.project?.title ?? "Project"]);
      if (!sameFounder(x.project)) continue;
      const cur = prior.get(x.investor_contact_id);
      if (!cur || IR_STAGES.indexOf(x.stage) > IR_STAGES.indexOf(cur.stage)) prior.set(x.investor_contact_id, { matchId: x.id, stage: x.stage, stageChangedAt: x.stage_changed_at, projectTitle: x.project?.title ?? "Project" });
    }
    return NextResponse.json({ investors: rows.map((r) => ({ id: r.id, name: r.name, firm: r.company, dataSource: r.inv_source, alsoOn: also.get(r.id) ?? [], onThisProject: here.has(r.id), founderOutreach: prior.get(r.id) ?? null })) });
  } catch (e) { return failed(e, "Couldn't search investors."); }
}
