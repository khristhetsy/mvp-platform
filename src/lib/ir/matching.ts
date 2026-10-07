/**
 * Matching queue for an IR project — proposals only, never writes. Runs the Investor Fit
 * engine (same scorer as /fit) over the investor match index, seeded from the project's
 * founder company, and drops anyone already on the project. Staff confirm; the route
 * that confirms is /api/admin/ir/matches.
 */
import { db, listMatches } from "@/lib/ir/db";
import { offerableSectors, rankScorables } from "@/lib/fit/match-investors";
import { scorablesForIndustries } from "@/lib/fit/match-index";
import { Q1_STAGE, Q2_RAISE, Q4_REVENUE, Q5_INVESTOR_TYPE, type FitAnswers } from "@/lib/fit/options";
import { IR_STAGES, type IrStage } from "@/lib/ir/types";
import { fitDefaultsFromProfile, founderOdooProfile } from "@/lib/ir/founder-profile";

export type QueueFilters = FitAnswers & { source: "any" | "verified" | "self_reported"; tier: "any" | "high" | "medium" | "low" };
/** The furthest this investor has got with the same founder on another of the founder's projects (e.g. an earlier month). */
export type FounderOutreach = { matchId: string; stage: IrStage; stageChangedAt: string; projectTitle: string };
export type QueueRow = {
  contactId: string; name: string | null; firm: string; fit: number; tier: "high" | "medium" | "low"; summary: string;
  sectors: string[]; types: string[]; dataSource: string | null; verifiedAt: string | null; alsoOn: string[];
  email: string; phone: string;
  founderOutreach: FounderOutreach | null;
};

export const fitTier = (fit: number): "high" | "medium" | "low" => (fit >= 70 ? "high" : fit >= 50 ? "medium" : "low");

/**
 * Sensible defaults: the founder company's industry, raise band and revenue stage, then
 * anything still missing from the founder's Odoo questionnaire (industries, capital sought,
 * revenue, operating stage, investor types). Odoo-imported projects have no company, so
 * without the questionnaire the queue had no sector and proposed nothing.
 */
export async function projectDefaults(companyId: string | null, founderContactId: string | null = null): Promise<Partial<FitAnswers> & { from?: "company" | "founder_profile" | "both" }> {
  const out: Partial<FitAnswers> & { from?: "company" | "founder_profile" | "both" } = companyId ? await companyDefaults(companyId) : {};
  if (Object.keys(out).length) out.from = "company";
  if (!founderContactId) return out;
  const { data } = await db().from("crm_contacts").select("raw, overrides").eq("id", founderContactId).maybeSingle();
  const fc = data as { raw: Record<string, unknown> | null; overrides: Record<string, unknown> | null } | null;
  const fromProfile = fitDefaultsFromProfile(founderOdooProfile(fc?.raw, fc?.overrides), await offerableSectors().catch(() => undefined));
  let used = false;
  for (const k of ["industry", "raise", "revenue", "stage", "investorType"] as const) {
    if (!out[k]?.length && fromProfile[k]?.length) { out[k] = fromProfile[k]; used = true; }
  }
  if (used) out.from = out.from ? "both" : "founder_profile";
  return out;
}

async function companyDefaults(companyId: string): Promise<Partial<FitAnswers>> {
  const { data } = await db().from("companies").select("industry, funding_amount, revenue_stage").eq("id", companyId).maybeSingle();
  const c = data as { industry: string | null; funding_amount: number | null; revenue_stage: string | null } | null;
  if (!c) return {};
  const out: Partial<FitAnswers> = {};
  if (c.industry) out.industry = [c.industry];
  if (c.funding_amount != null) { const band = Q2_RAISE.find((r) => c.funding_amount! >= r.min && c.funding_amount! < r.max); if (band) out.raise = [band.key]; }
  if (c.revenue_stage) {
    const rs = c.revenue_stage.toLowerCase();
    const rev = rs.includes("pre") ? "pre_revenue" : /1m|10m|50m|100m/.test(rs) ? "1m_5m" : "under_1m";
    out.revenue = [rev];
  }
  return out;
}

/** Odoo writes an empty field as `false`; read through raw->>… that is the string "false". Same rule as the Contacts list. */
const odooText = (v: string | null | undefined) => { const t = (v ?? "").trim(); return t === "" || t.toLowerCase() === "false" ? "" : t; };
const phoneOf = (m: { phone: string | null; raw_phone: string | null; raw_mobile: string | null } | undefined) => (m ? m.phone || odooText(m.raw_phone) || odooText(m.raw_mobile) : "");

/** One proposed investor in the full ranked list: [contactId, fit tier, data source, already contacted for this founder]. */
export type QueueEntry = [string, "high" | "medium" | "low", string | null, 0 | 1];
export type QueueSortKey = "name" | "outreach" | "firm" | "phone" | "email" | "fit" | "why" | "sectors" | "types" | "source" | "also";
/** Which page of the proposals to return, and the list controls that must apply to all of them (not only one page). */
export type QueueView = { offset: number; limit: number; q: string; hideContacted: boolean; sort: { key: QueueSortKey; dir: "asc" | "desc" } | null };
export const QUEUE_PAGE = 50;
const DEFAULT_VIEW: QueueView = { offset: 0, limit: QUEUE_PAGE, q: "", hideContacted: false, sort: null };

type Light = { contactId: string; firm: string; fit: number; tier: "high" | "medium" | "low"; summary: string; sectors: string[]; types: string[]; dataSource: string | null; verifiedAt: string | null; stage: IrStage | null };

/** Sorts the full list on what the index already holds; Investor, Phone, Email and Also matched need contact rows, so the page sorts those itself. Blanks last. */
function sortLight(rows: Light[], s: QueueView["sort"]): Light[] {
  if (!s) return rows;
  const t = (v: string) => v.trim() || null;
  const val = (r: Light): string | number | null => {
    switch (s.key) {
      case "firm": return t(r.firm);
      case "fit": return r.fit;
      case "why": return t(r.summary);
      case "sectors": return t(r.sectors.join(", "));
      case "types": return t(r.types.join(", "));
      case "source": return r.dataSource === "verified" ? "Verified" : r.dataSource === "self_reported" ? "Self-reported" : "Unverified";
      case "outreach": return r.stage ? IR_STAGES.indexOf(r.stage) : null;
      default: return null;
    }
  };
  if (!["firm", "fit", "why", "sectors", "types", "source", "outreach"].includes(s.key)) return rows;
  const mul = s.dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const x = val(a), y = val(b);
    if (x === null && y === null) return 0;
    if (x === null) return 1;
    if (y === null) return -1;
    if (typeof x === "number" && typeof y === "number") return (x - y) * mul;
    return String(x).localeCompare(String(y), undefined, { numeric: true, sensitivity: "base" }) * mul;
  });
}

/**
 * Every proposal for the filters, ranked, with one page of full rows. The ranking, the
 * source and tier filters, "Hide already contacted", the search text and most sorts run
 * over the whole list; only the page's rows load contact details (name, email, phone),
 * because reading those for all ~4k investors takes ~9 s on this database. `all` carries
 * every proposal's id, tier, source and contacted flag so "Select all" and Confirm cover
 * the whole list. `total` stays the header count (every proposal before source / tier).
 */
export async function proposeMatches(projectId: string, f: QueueFilters, view: QueueView = DEFAULT_VIEW): Promise<{ rows: QueueRow[]; total: number; filtered: number; offset: number; all: QueueEntry[]; contacted: number; thin: boolean }> {
  const empty = { rows: [], total: 0, filtered: 0, offset: 0, all: [], contacted: 0 };
  if (!f.industry.length) return { ...empty, thin: false };
  const scorables = await scorablesForIndustries(f.industry).catch(() => null);
  if (scorables === null) return { ...empty, thin: true };   // index unusable — say so rather than scan 7k raw rows
  const answers: FitAnswers = { stage: f.stage, raise: f.raise, industry: f.industry, revenue: f.revenue, investorType: f.investorType.length ? f.investorType : ["any"] };
  const ranked = rankScorables(scorables, answers);
  const src = new Map(scorables.map((s) => [s.id, { source: s.inv_source ?? null, verifiedAt: s.inv_verified_at ?? null }]));

  const onProject = new Set((await listMatches(projectId)).map((m) => m.investor_contact_id));
  const ids = ranked.map((r) => r.contactId).filter((id) => !onProject.has(id));
  const { data: self } = await db().from("ir_projects").select("company_id, founder_contact_id").eq("id", projectId).maybeSingle();
  const me = self as { company_id: string | null; founder_contact_id: string | null } | null;
  const contactedStage = await founderContactedIds(projectId, me);

  // Search text: firm, why, sectors and types from the index; name, email and phone through the
  // trigram indexes from 3 characters (~0.2 s). Shorter text can't use them and scans the whole
  // contacts table (~9 s), so 1 to 2 characters search the index fields only.
  const q = view.q.trim();
  let nameHits = new Set<string>();
  if (q.length >= 3) {
    const like = `%${q.replace(/[%_,()]/g, " ")}%`;
    const { data: hits } = await db().from("crm_contacts").select("id").or(`name.ilike.${like},email.ilike.${like},phone.ilike.${like}`).limit(5000);
    nameHits = new Set(((hits ?? []) as Array<{ id: string }>).map((h) => h.id));
  }
  const ql = q.toLowerCase();

  let list: Light[] = [];
  for (const r of ranked) {
    if (onProject.has(r.contactId)) continue;
    const tier = fitTier(r.fit);
    const s = src.get(r.contactId);
    const source = s?.source ?? null;
    if (f.source !== "any" && source !== f.source) continue;
    if (f.tier !== "any" && tier !== f.tier) continue;
    list.push({ contactId: r.contactId, firm: r.company, fit: r.fit, tier, summary: r.summary, sectors: r.sectors, types: r.types, dataSource: source, verifiedAt: s?.verifiedAt ?? null, stage: contactedStage.get(r.contactId) ?? null });
  }
  if (view.hideContacted) list = list.filter((r) => !r.stage);
  if (q) list = list.filter((r) => nameHits.has(r.contactId) || [r.firm, r.summary, r.sectors.join(" "), r.types.join(" ")].some((v) => v.toLowerCase().includes(ql)));
  list = sortLight(list, view.sort);

  const filtered = list.length;
  const limit = Math.max(1, Math.min(200, view.limit));
  const offset = Math.max(0, Math.min(view.offset, Math.max(0, filtered - 1)));
  const page = list.slice(offset, offset + limit);
  const pageIds = page.map((r) => r.contactId);
  const [{ data: contacts }, { data: elsewhere }] = await Promise.all([
    pageIds.length ? db().from("crm_contacts").select("id, name, email, phone, raw_phone:raw->>phone, raw_mobile:raw->>mobile").in("id", pageIds) : { data: [] },
    pageIds.length ? db().from("ir_matches").select("id, investor_contact_id, stage, stage_changed_at, project:ir_projects(title, company_id, founder_contact_id)").in("investor_contact_id", pageIds) : { data: [] },
  ]);
  const meta = new Map(((contacts ?? []) as Array<{ id: string; name: string | null; email: string | null; phone: string | null; raw_phone: string | null; raw_mobile: string | null }>).map((c) => [c.id, c]));
  const sameFounder = (p: { company_id: string | null; founder_contact_id: string | null } | null) =>
    !!p && !!me && ((!!me.company_id && p.company_id === me.company_id) || (!!me.founder_contact_id && p.founder_contact_id === me.founder_contact_id));
  const also = new Map<string, string[]>();
  const prior = new Map<string, FounderOutreach>();
  type Elsewhere = { id: string; investor_contact_id: string; stage: IrStage; stage_changed_at: string; project: { title: string; company_id: string | null; founder_contact_id: string | null } | null };
  for (const e of (elsewhere ?? []) as Elsewhere[]) {
    also.set(e.investor_contact_id, [...(also.get(e.investor_contact_id) ?? []), e.project?.title ?? "Project"]);
    if (!sameFounder(e.project)) continue;
    const cur = prior.get(e.investor_contact_id);
    // Keep the furthest stage; on a tie, the most recent change.
    const further = !cur || IR_STAGES.indexOf(e.stage) > IR_STAGES.indexOf(cur.stage) || (e.stage === cur.stage && e.stage_changed_at > cur.stageChangedAt);
    if (further) prior.set(e.investor_contact_id, { matchId: e.id, stage: e.stage, stageChangedAt: e.stage_changed_at, projectTitle: e.project?.title ?? "Project" });
  }

  const rows: QueueRow[] = page.map((r) => {
    const m = meta.get(r.contactId);
    return { contactId: r.contactId, name: m?.name ?? null, firm: r.firm, fit: r.fit, tier: r.tier, summary: r.summary, sectors: r.sectors, types: r.types, dataSource: r.dataSource, verifiedAt: r.verifiedAt, alsoOn: also.get(r.contactId) ?? [], email: m?.email ?? "", phone: phoneOf(m), founderOutreach: prior.get(r.contactId) ?? null };
  });
  const all: QueueEntry[] = list.map((r) => [r.contactId, r.tier, r.dataSource, r.stage ? 1 : 0]);
  return { rows, total: ids.length, filtered, offset, all, contacted: ids.filter((id) => contactedStage.has(id)).length, thin: false };
}

/**
 * Investors already matched on another of this founder's projects (same company or same
 * founder contact) — the "already contacted" set behind the queue's header counts, with the
 * furthest stage each reached (for the Outreach sort). Two small queries over the founder's
 * own matches, so it covers every proposed investor, not only one page.
 */
async function founderContactedIds(projectId: string, me: { company_id: string | null; founder_contact_id: string | null } | null): Promise<Map<string, IrStage>> {
  const ors = [me?.company_id ? `company_id.eq.${me.company_id}` : null, me?.founder_contact_id ? `founder_contact_id.eq.${me.founder_contact_id}` : null].filter(Boolean) as string[];
  if (!ors.length) return new Map();
  const { data: projects } = await db().from("ir_projects").select("id").or(ors.join(",")).neq("id", projectId);
  const pids = ((projects ?? []) as Array<{ id: string }>).map((p) => p.id);
  if (!pids.length) return new Map();
  const { data: ms } = await db().from("ir_matches").select("investor_contact_id, stage").in("project_id", pids);
  const out = new Map<string, IrStage>();
  for (const m of (ms ?? []) as Array<{ investor_contact_id: string; stage: IrStage }>) {
    const cur = out.get(m.investor_contact_id);
    if (!cur || IR_STAGES.indexOf(m.stage) > IR_STAGES.indexOf(cur)) out.set(m.investor_contact_id, m.stage);
  }
  return out;
}

export async function queueOptions(): Promise<{ sectors: string[]; stages: Array<{ key: string; label: string }>; raises: Array<{ key: string; label: string }>; revenues: Array<{ key: string; label: string }>; types: Array<{ key: string; label: string }> }> {
  return {
    sectors: await offerableSectors(),
    stages: Q1_STAGE.map((o) => ({ key: o.key, label: o.label })),
    raises: Q2_RAISE.map((o) => ({ key: o.key, label: o.label })),
    revenues: Q4_REVENUE.map((o) => ({ key: o.key, label: o.label })),
    types: Q5_INVESTOR_TYPE.map((o) => ({ key: o.key, label: o.label })),
  };
}
