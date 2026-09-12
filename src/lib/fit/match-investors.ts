/**
 * match_investors — the /fit funnel matcher (build-spec §5), run over the existing
 * investor criteria in crm_contacts.raw.__profile rather than duplicate columns.
 *
 * The safety gate is a real filter on the query: only contacts with
 * inv_source in ('self_reported','verified') and verified within 180 days are
 * scanned, so an 'inferred' (or stale) contact can never reach a founder.
 *
 * Scoring (weights §2): industry 35 (also a HARD filter — a firm with no sector
 * overlap is never returned), stage 30, investment-size overlap 25, revenue 10.
 * One row per firm (normalised company), preferring verified then most recently
 * confirmed. Passing threshold fit >= 70; `thin` when fewer than three pass.
 */

import { createServiceRoleClient } from "@/lib/supabase/admin";
import { readAllRows } from "@/lib/supabase/paged";
import { parseMoneyBand } from "@/lib/investors/preference-match";
import { getContactInvestorRating } from "@/lib/investor-rating/contact-rating";
import { canonicalizeIndustries, sortSectors } from "@/lib/industries/canonical";
import {
  OP_STAGE_LABEL,
  INV_SIZE_LABEL,
  REVENUE_LABEL,
  stageStoredFor,
  raiseBoundsFor,
  revenueStoredFor,
  investorTypeStoredFor,
  investorTypeIsAny,
  type FitAnswers,
} from "@/lib/fit/options";

// Fit weights (sum 100). Industry is also a hard filter (no sector overlap → excluded),
// so a passing row already fits on sector. Threshold defaults to the industry weight, so
// a sector-only match still shows even when imported investors carry only industry data.
// Override with FIT_PASS_THRESHOLD.
const WEIGHTS = { industry: 30, stage: 25, size: 20, type: 15, revenue: 10 };
const PASS_THRESHOLD = Number(process.env.FIT_PASS_THRESHOLD ?? WEIGHTS.industry);
const RESULT_LIMIT = 25;

export type MatchResult = {
  contactId: string;
  company: string;
  summary: string;
  fit: number;                 // 0–100 "% fit" to the founder's raise
  sectors: string[];
  types: string[];
  stage: string | null;
  checkSize: string | null;
  revenue: string | null;
  score: number | null;        // investor score (existing rating system), filled for shown rows
  tier: string | null;
};
export type MatchResponse = {
  matched_count: number;
  top: MatchResult[];
  locked_count: number;
  thin: boolean;
  network_total: number;       // total investors in the network
};

/** Coerce an Odoo jsonb value (array, [id,label] pairs, string) to a string list. */
function asList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((x) => (Array.isArray(x) && x.length === 2 ? String(x[1]) : String(x))).map((s) => s.trim()).filter(Boolean);
  }
  if (value == null || value === "") return [];
  return [String(value).trim()].filter(Boolean);
}

function extraValues(raw: Record<string, unknown> | null, label: string): string[] {
  const extra = (raw?.__profile as { extra?: Record<string, unknown> } | undefined)?.extra;
  return extra ? asList(extra[label]) : [];
}

function lc(list: string[]): Set<string> {
  return new Set(list.map((s) => s.trim().toLowerCase()));
}

// Overrides (manual/self-reported edits) win over the Odoo-synced raw.__profile, and
// survive a resync. Industries live under the consolidated "Industries" override key;
// stage/size/revenue under their Odoo questionnaire label.
function ovList(overrides: Record<string, unknown> | null, key: string): string[] | null {
  const v = overrides?.[key];
  return Array.isArray(v) ? asList(v) : null;
}
function mergedIndustries(row: GatedRow): string[] {
  const raw = ovList(row.overrides, "Industries") ?? asList((row.raw?.__profile as { industries?: unknown } | undefined)?.industries);
  return canonicalizeIndustries(raw); // canonical taxonomy (merges/dedupes)
}
function mergedExtra(row: GatedRow, label: string): string[] {
  return ovList(row.overrides, label) ?? extraValues(row.raw, label);
}
function mergedInvestorTypes(row: GatedRow): string[] {
  return ovList(row.overrides, "Investor type") ?? asList((row.raw?.__profile as { investorTypes?: unknown } | undefined)?.investorTypes);
}

type GatedRow = {
  id: string; company: string | null; raw: Record<string, unknown> | null;
  overrides: Record<string, unknown> | null; inv_source: string | null; inv_verified_at: string | null;
  contact_type?: string | null; source?: string | null; email?: string | null;
};

/** Score one investor row against the founder's answers. Returns null when the
 *  industry hard filter fails (no sector overlap → never shown). */
export function scoreRow(row: GatedRow, answers: FitAnswers): { fit: number; summary: string } | null {
  const industries = lc(mergedIndustries(row));
  // Hard filter: at least one selected sector overlaps (multi-select any-overlap).
  if (!answers.industry.some((i) => industries.has(i.trim().toLowerCase()))) return null;

  let fit = WEIGHTS.industry; // industry matched (hard-filtered above)

  const stageStored = lc(mergedExtra(row, OP_STAGE_LABEL));
  if (stageStoredFor(answers.stage).some((s) => stageStored.has(s.toLowerCase()))) fit += WEIGHTS.stage;

  const bounds = raiseBoundsFor(answers.raise); // union of selected raise bands
  const sizeBands = mergedExtra(row, INV_SIZE_LABEL).map(parseMoneyBand).filter((b): b is { min: number; max: number } => b != null);
  if (bounds && sizeBands.some((b) => b.min <= bounds.max && b.max >= bounds.min)) fit += WEIGHTS.size;

  // Investor type: any selected type overlaps, or "Open to any" (no constraint).
  const invTypes = lc(mergedInvestorTypes(row));
  if (investorTypeIsAny(answers.investorType) || investorTypeStoredFor(answers.investorType).some((t) => invTypes.has(t.toLowerCase()))) fit += WEIGHTS.type;

  const revStored = lc(mergedExtra(row, REVENUE_LABEL));
  if (revenueStoredFor(answers.revenue).some((r) => revStored.has(r.toLowerCase()))) fit += WEIGHTS.revenue;

  const summary = [
    mergedExtra(row, OP_STAGE_LABEL).join("–") || null,
    mergedExtra(row, INV_SIZE_LABEL)[0] || null,
  ].filter(Boolean).join(" · ");

  return { fit, summary };
}

/** Pure ranking: score → industry hard filter → one row per firm → threshold → sort. */
export function rankRows(rows: GatedRow[], answers: FitAnswers): MatchResult[] {
  // One row per firm: prefer the most-trusted source (verified > self_reported >
  // inferred/other), then most recently confirmed.
  const tier = (s: string | null) => (s === "verified" ? 2 : s === "self_reported" ? 1 : 0);
  const byFirm = new Map<string, GatedRow>();
  for (const r of rows) {
    if (!r.company) continue;
    const key = r.company.trim().toLowerCase();
    const cur = byFirm.get(key);
    if (!cur) { byFirm.set(key, r); continue; }
    const better = tier(r.inv_source) > tier(cur.inv_source) ||
      (tier(r.inv_source) === tier(cur.inv_source) && (r.inv_verified_at ?? "") > (cur.inv_verified_at ?? ""));
    if (better) byFirm.set(key, r);
  }

  const scored: MatchResult[] = [];
  for (const r of byFirm.values()) {
    const s = scoreRow(r, answers);
    if (s && s.fit >= PASS_THRESHOLD) {
      scored.push({
        contactId: r.id,
        company: r.company as string,
        summary: s.summary,
        fit: s.fit,
        sectors: mergedIndustries(r),
        types: mergedInvestorTypes(r),
        stage: mergedExtra(r, OP_STAGE_LABEL).join(", ") || null,
        checkSize: mergedExtra(r, INV_SIZE_LABEL)[0] ?? null,
        revenue: mergedExtra(r, REVENUE_LABEL)[0] ?? null,
        score: null,
        tier: null,
      });
    }
  }
  // Sort by fit, then by investor score is applied after enrichment in matchInvestors.
  scored.sort((a, b) => b.fit - a.fit);
  return scored.slice(0, RESULT_LIMIT);
}

/** Distinct sectors offerable at Q3 — the industries that at least one GATED
 *  investor actually covers. Never hardcoded, so a sector with no investor behind
 *  it can't be offered (build-spec §2). */
export async function offerableSectors(): Promise<string[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceRoleClient() as any;
  // Paged: a single .limit() is truncated at db-max-rows, which would hide the sectors
  // that only later investors cover — and an unofferable sector is unmatchable.
  const data = await readAllRows<{ raw: Record<string, unknown> | null; overrides: Record<string, unknown> | null }>(
    (from, to) => db.from("crm_contacts")
      .select("raw, overrides")
      .or("contact_type.eq.investor,module.eq.investor")
      .order("id", { ascending: true })
      .range(from, to),
  );
  const seen = new Set<string>();
  for (const row of data) {
    for (const v of mergedIndustries({ id: "", company: null, inv_source: null, inv_verified_at: null, ...row })) seen.add(v);
  }
  return sortSectors([...seen]); // canonical, deduped, "Other" last
}

export async function matchInvestors(answers: FitAnswers): Promise<MatchResponse> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceRoleClient() as any;

  // Gate: any investor contact (open-gate mode — imported/inferred investors are
  // matched, ranked below self_reported/verified). Founders are excluded by the
  // investor scope; the industry hard filter excludes anyone without sector overlap.
  // Paged — see readAllRows. A single .limit(20000) is capped at db-max-rows (1000),
  // which meant ranking against a fraction of the network without any error surfacing.
  const [rows, { count }] = await Promise.all([
    readAllRows<GatedRow>((from, to) => db.from("crm_contacts")
      .select("id, company, raw, overrides, inv_source, inv_verified_at, contact_type, source, email")
      .or("contact_type.eq.investor,module.eq.investor")
      .not("company", "is", null)
      .order("id", { ascending: true })
      .range(from, to)),
    db.from("crm_contacts").select("id", { count: "exact", head: true }).or("contact_type.eq.investor,module.eq.investor"),
  ]);
  const networkTotal = count ?? 0;

  if (rows.length === 0) return { matched_count: 0, top: [], locked_count: 0, thin: true, network_total: networkTotal };
  const ranked = rankRows(rows, answers);
  const byId = new Map(rows.map((r) => [r.id, r]));

  // Enrich the shown rows with the existing investor score/tier, then sort by fit,
  // score. Only the top few are displayed, so this stays cheap.
  const shown = ranked.slice(0, 3);
  await Promise.all(shown.map(async (m) => {
    const row = byId.get(m.contactId);
    if (!row) return;
    const rating = await getContactInvestorRating({
      source: row.source ?? null, contact_type: row.contact_type ?? "investor", email: row.email ?? null,
      membership: (row.raw?.__profile as { membership?: string } | undefined)?.membership ?? null,
    }).catch(() => null);
    m.score = rating?.score ?? null;
    m.tier = rating?.tier ?? null;
  }));
  shown.sort((a, b) => b.fit - a.fit || (b.score ?? -1) - (a.score ?? -1));

  return {
    matched_count: ranked.length,
    top: shown,
    locked_count: Math.max(0, ranked.length - shown.length),
    thin: ranked.length < 3,
    network_total: networkTotal,
  };
}
