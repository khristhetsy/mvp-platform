/**
 * One investor, for the matching queue's profile panel — name / firm / data source and every
 * IR match they are on, never phone or email.
 *   GET → { investor: { id, name, firm, dataSource, verifiedAt, website }, matches: [{ matchId, projectId, projectTitle, founderName, stage, stageChangedAt }] }
 *   GET ?detail=1 → also `contact` for the Odoo-style contact popup on the task's Matching tab:
 *       phone, email, address, job position, created on, assigned staff, membership and the
 *       investor questionnaire. Same IR-staff access that already shows phone / email there.
 */
import { NextRequest, NextResponse } from "next/server";
import { irStaff, forbidden, failed } from "@/lib/ir/auth";
import { db, nameMap } from "@/lib/ir/db";
import type { IrStage } from "@/lib/ir/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  if (!(await irStaff())) return forbidden();
  const { id } = await ctx.params;
  try {
    const [{ data: c }, { data: m }] = await Promise.all([
      db().from("crm_contacts").select(req.nextUrl.searchParams.get("detail") ? "id, name, company, inv_source, inv_verified_at, website, email, phone, country, contact_type, created_on, assignee_ids, profile, raw, overrides" : "id, name, company, inv_source, inv_verified_at, website").eq("id", id).maybeSingle(),
      db().from("ir_matches").select("id, project_id, stage, stage_changed_at, project:ir_projects(title, founder_name)").eq("investor_contact_id", id).order("stage_changed_at", { ascending: false }),
    ]);
    const inv = c as { id: string; name: string | null; company: string | null; inv_source: string | null; inv_verified_at: string | null; website: string | null } | null;
    if (!inv) return NextResponse.json({ error: "Investor not found." }, { status: 404 });
    type Row = { id: string; project_id: string; stage: IrStage; stage_changed_at: string; project: { title: string; founder_name: string | null } | null };
    const contact = req.nextUrl.searchParams.get("detail") ? await contactDetail(c as unknown as DetailRow) : undefined;
    return NextResponse.json({
      contact,
      investor: { id: inv.id, name: inv.name, firm: inv.company, dataSource: inv.inv_source, verifiedAt: inv.inv_verified_at, website: inv.website },
      matches: ((m ?? []) as Row[]).map((r) => ({ matchId: r.id, projectId: r.project_id, projectTitle: r.project?.title ?? "Project", founderName: r.project?.founder_name ?? null, stage: r.stage, stageChangedAt: r.stage_changed_at })),
    });
  } catch (e) { return failed(e, "Couldn't load the investor."); }
}

type DetailRow = { email: string | null; phone: string | null; country: string | null; contact_type: string | null; created_on: string | null; assignee_ids: string[] | null; website: string | null; profile: Record<string, unknown> | null; raw: Record<string, unknown> | null; overrides?: Record<string, unknown> | null };
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const m2o = (v: unknown) => (Array.isArray(v) && typeof v[1] === "string" ? v[1] : null);
const list = (v: unknown) => (Array.isArray(v) ? v.map(String).filter(Boolean) : typeof v === "string" && v ? [v] : []);

async function contactDetail(c: DetailRow) {
  const raw = c.raw ?? {};
  const p = c.profile ?? ((raw.__profile as Record<string, unknown> | undefined) ?? {});
  const extra = ((p.extra ?? (raw.__profile as Record<string, unknown> | undefined)?.extra) as Record<string, unknown> | undefined) ?? {};
  const byKeyword = (re: RegExp) => { const k = Object.keys(extra).find((x) => re.test(x)); return k ? list(extra[k]) : []; };
  const names = await nameMap(c.assignee_ids ?? []);
  // Odoo's value wins; a filled or approved value (crm_contacts.overrides) shows only when
  // Odoo has none, so the popup no longer reads blank for investors the fill completed.
  const orOv = (odoo: string[], key: string) => (odoo.length ? odoo : list(c.overrides?.[key]));
  return {
    email: c.email, phone: c.phone ?? str(raw.phone) ?? str(raw.mobile), mobile: str(raw.mobile),
    jobPosition: str(raw.function), website: c.website ?? str(raw.website),
    address: { street: str(raw.street), city: str(raw.city), state: m2o(raw.state_id), zip: str(raw.zip), country: c.country ?? m2o(raw.country_id) },
    createdOn: c.created_on ?? str(raw.create_date), membership: str(p.membership) ?? (c.contact_type ? c.contact_type[0].toUpperCase() + c.contact_type.slice(1) : null),
    assignees: (c.assignee_ids ?? []).map((id) => names.get(id)).filter(Boolean),
    profile: {
      investorTypes: orOv(list(p.investorTypes), "Investor type"), industries: orOv(list(p.industries), "Industries"), operatingStages: list(p.operatingStages), fundingStages: orOv(list(p.fundingStages), "Funding stage"),
      capital: orOv(list(p.capital), "Capital type"), businessEntity: orOv(list(p.businessEntity), "Business entity"),
      investmentSize: byKeyword(/investment size|check size/i), revenueRange: byKeyword(/annual revenue range|revenue range/i),
    },
  };
}
