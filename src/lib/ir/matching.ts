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

export type QueueFilters = FitAnswers & { source: "any" | "verified" | "self_reported"; tier: "any" | "high" | "medium" | "low" };
export type QueueRow = {
  contactId: string; name: string | null; firm: string; fit: number; tier: "high" | "medium" | "low"; summary: string;
  sectors: string[]; types: string[]; dataSource: string | null; verifiedAt: string | null; alsoOn: string[];
};

export const fitTier = (fit: number): "high" | "medium" | "low" => (fit >= 70 ? "high" : fit >= 50 ? "medium" : "low");

/** Sensible defaults from the founder company: its industry, raise band, revenue stage. */
export async function projectDefaults(companyId: string | null): Promise<Partial<FitAnswers>> {
  if (!companyId) return {};
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
  const [{ data: contacts }, { data: elsewhere }] = await Promise.all([
    ids.length ? db().from("crm_contacts").select("id, name, inv_source, inv_verified_at").in("id", ids.slice(0, 400)) : { data: [] },
    ids.length ? db().from("ir_matches").select("investor_contact_id, project:ir_projects(title)").in("investor_contact_id", ids.slice(0, 400)) : { data: [] },
  ]);
  const meta = new Map(((contacts ?? []) as Array<{ id: string; name: string | null; inv_source: string | null; inv_verified_at: string | null }>).map((c) => [c.id, c]));
  const also = new Map<string, string[]>();
  for (const e of (elsewhere ?? []) as Array<{ investor_contact_id: string; project: { title: string } | null }>) also.set(e.investor_contact_id, [...(also.get(e.investor_contact_id) ?? []), e.project?.title ?? "Project"]);

  const rows: QueueRow[] = [];
  for (const r of ranked) {
    if (onProject.has(r.contactId)) continue;
    const m = meta.get(r.contactId);
    const tier = fitTier(r.fit);
    const src = m?.inv_source ?? null;
    if (f.source !== "any" && src !== f.source) continue;
    if (f.tier !== "any" && tier !== f.tier) continue;
    rows.push({ contactId: r.contactId, name: m?.name ?? null, firm: r.company, fit: r.fit, tier, summary: r.summary, sectors: r.sectors, types: r.types, dataSource: src, verifiedAt: m?.inv_verified_at ?? null, alsoOn: also.get(r.contactId) ?? [] });
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
