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
  const { data } = await db().from("crm_contacts").select("raw").eq("id", founderContactId).maybeSingle();
  const fromProfile = fitDefaultsFromProfile(founderOdooProfile((data as { raw: Record<string, unknown> | null } | null)?.raw), await offerableSectors().catch(() => undefined));
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

export async function proposeMatches(projectId: string, f: QueueFilters): Promise<{ rows: QueueRow[]; total: number; thin: boolean }> {
  if (!f.industry.length) return { rows: [], total: 0, thin: false };
  const scorables = await scorablesForIndustries(f.industry).catch(() => null);
  if (scorables === null) return { rows: [], total: 0, thin: true };   // index unusable — say so rather than scan 7k raw rows
  const answers: FitAnswers = { stage: f.stage, raise: f.raise, industry: f.industry, revenue: f.revenue, investorType: f.investorType.length ? f.investorType : ["any"] };
  const ranked = rankScorables(scorables, answers);

  const onProject = new Set((await listMatches(projectId)).map((m) => m.investor_contact_id));
  const ids = ranked.map((r) => r.contactId).filter((id) => !onProject.has(id));
  const [{ data: contacts }, { data: elsewhere }, { data: self }] = await Promise.all([
    ids.length ? db().from("crm_contacts").select("id, name, inv_source, inv_verified_at").in("id", ids.slice(0, 400)) : { data: [] },
    ids.length ? db().from("ir_matches").select("id, investor_contact_id, stage, stage_changed_at, project:ir_projects(title, company_id, founder_contact_id)").in("investor_contact_id", ids.slice(0, 400)) : { data: [] },
    db().from("ir_projects").select("company_id, founder_contact_id").eq("id", projectId).maybeSingle(),
  ]);
  const meta = new Map(((contacts ?? []) as Array<{ id: string; name: string | null; inv_source: string | null; inv_verified_at: string | null }>).map((c) => [c.id, c]));
  const me = self as { company_id: string | null; founder_contact_id: string | null } | null;
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

  const rows: QueueRow[] = [];
  for (const r of ranked) {
    if (onProject.has(r.contactId)) continue;
    const m = meta.get(r.contactId);
    const tier = fitTier(r.fit);
    const src = m?.inv_source ?? null;
    if (f.source !== "any" && src !== f.source) continue;
    if (f.tier !== "any" && tier !== f.tier) continue;
    rows.push({ contactId: r.contactId, name: m?.name ?? null, firm: r.company, fit: r.fit, tier, summary: r.summary, sectors: r.sectors, types: r.types, dataSource: src, verifiedAt: m?.inv_verified_at ?? null, alsoOn: also.get(r.contactId) ?? [], founderOutreach: prior.get(r.contactId) ?? null });
    if (rows.length >= 200) break;
  }
  return { rows, total: ranked.length - [...onProject].filter((id) => ranked.some((r) => r.contactId === id)).length, thin: false };
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
