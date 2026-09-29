/**
 * Investor lookup for "Add matches" — name / firm / data source only, never phone or email.
 *   GET ?q=<text>&project=<id> → { investors: [{ id, name, firm, dataSource, sectors, types, alsoOn: [project titles], onThisProject, founderOutreach }] }
 * `sectors` / `types` come from investor_match_index (the same values Proposed matches shows);
 * contacts not in the index are projected from their own row, at most one page of 50.
 *   GET ?ids=<id,id,…>&project=<id> → same shape for those contacts (at most 100): the matching
 * queue's "Search all investors" lists through the Contacts search and tops its rows up here.
 * `founderOutreach` is the furthest stage this investor reached with the same founder on another
 * of the founder's projects (the matching queue's Outreach column), or null.
 */
import { NextRequest, NextResponse } from "next/server";
import { irStaff, forbidden, failed } from "@/lib/ir/auth";
import { db } from "@/lib/ir/db";
import { IR_STAGES, type IrStage } from "@/lib/ir/types";
import { fieldsOf, type GatedRow } from "@/lib/fit/match-investors";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
  if (!(await irStaff())) return forbidden();
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  const projectId = req.nextUrl.searchParams.get("project");
  const idList = (req.nextUrl.searchParams.get("ids") ?? "").split(",").map((x) => x.trim()).filter((x) => /^[0-9a-f-]{36}$/i.test(x)).slice(0, 100);
  if (!idList.length && q.length < 2) return NextResponse.json({ investors: [] });
  try {
    let data: unknown[] | null; let error: { message: string } | null;
    if (idList.length) {
      ({ data, error } = await db().from("crm_contacts").select("id, name, company, inv_source").in("id", idList));
    } else {
      const like = `%${q.replace(/[%_,]/g, " ")}%`;
      ({ data, error } = await db().from("crm_contacts").select("id, name, company, inv_source")
        .eq("contact_type", "investor").or(`name.ilike.${like},company.ilike.${like},email.ilike.${like}`).order("name").limit(50));
    }
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as Array<{ id: string; name: string | null; company: string | null; inv_source: string | null }>;
    const ids = rows.map((r) => r.id);
    const [{ data: m }, { data: self }, { data: idx }] = await Promise.all([
      ids.length ? db().from("ir_matches").select("id, investor_contact_id, project_id, stage, stage_changed_at, project:ir_projects(title, company_id, founder_contact_id)").in("investor_contact_id", ids) : { data: [] },
      projectId ? db().from("ir_projects").select("company_id, founder_contact_id").eq("id", projectId).maybeSingle() : { data: null },
      ids.length ? db().from("investor_match_index").select("contact_id, industries, types").in("contact_id", ids) : { data: [] },
    ]);
    const tags = new Map<string, { sectors: string[]; types: string[] }>();
    for (const x of (idx ?? []) as Array<{ contact_id: string; industries: string[] | null; types: string[] | null }>) tags.set(x.contact_id, { sectors: x.industries ?? [], types: x.types ?? [] });
    const missing = ids.filter((id) => !tags.has(id));
    if (missing.length) {
      const { data: wide } = await db().from("crm_contacts").select("id, company, raw, overrides, inv_source, inv_verified_at").in("id", missing);
      for (const w of (wide ?? []) as GatedRow[]) { const f = fieldsOf(w); tags.set(w.id, { sectors: f.industries, types: f.types }); }
    }
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
    return NextResponse.json({ investors: rows.map((r) => ({ id: r.id, name: r.name, firm: r.company, dataSource: r.inv_source, sectors: tags.get(r.id)?.sectors ?? [], types: tags.get(r.id)?.types ?? [], alsoOn: also.get(r.id) ?? [], onThisProject: here.has(r.id), founderOutreach: prior.get(r.id) ?? null })) });
  } catch (e) { return failed(e, "Couldn't search investors."); }
}
