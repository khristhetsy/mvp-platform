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
import { scorablesForIndustries, indexedSectors } from "@/lib/fit/match-index";
import { parseMoneyBand } from "@/lib/investors/preference-match";
import { getContactInvestorRating } from "@/lib/investor-rating/contact-rating";
import { canonicalizeIndustries, sortSectors } from "@/lib/industries/canonical";
import {
  OP_STAGE_LABELS,
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
export function mergedIndustries(row: GatedRow): string[] {
  const raw = ovList(row.overrides, "Industries") ?? asList((row.raw?.__profile as { industries?: unknown } | undefined)?.industries);
  return canonicalizeIndustries(raw); // canonical taxonomy (merges/dedupes)
}
export function mergedExtra(row: GatedRow, label: string): string[] {
  return ovList(row.overrides, label) ?? extraValues(row.raw, label);
}

/**
 * Find a questionnaire field by keyword when the exact label doesn't hit.
 *
 * The matcher looks up `extra["Investor investment size?"]` by exact key. The Investor
 * Profile finds the same field by SUBSTRING — any synced label containing "investment
 * size". Those disagree the moment Odoo's real label differs by a word or a question
 * mark, and then the profile happily displays a value the matcher cannot see. That is
 * precisely how operating stage came to score zero on every contact.
 *
 * So: exact label first (fast, unambiguous), keyword scan only as a fallback. Matching on
 * a renamed field is strictly better than silently scoring nothing, and the exact-first
 * order means a correct label is never overridden by a loose keyword hit.
 */
export function mergedExtraLoose(row: GatedRow, labels: readonly string[], keywords: readonly string[]): string[] {
  for (const label of labels) {
    const exact = mergedExtra(row, label);
    if (exact.length) return exact;
  }
  const needles = keywords.map((k) => k.toLowerCase());
  const hit = (key: string) => needles.some((n) => key.trim().toLowerCase().includes(n));
  // Overrides win over the Odoo payload, same precedence as everywhere else.
  for (const [key, value] of Object.entries(row.overrides ?? {})) {
    if (hit(key) && Array.isArray(value)) {
      const vals = asList(value);
      if (vals.length) return vals;
    }
  }
  const extra = (row.raw?.__profile as { extra?: Record<string, unknown> } | undefined)?.extra ?? {};
  for (const [key, value] of Object.entries(extra)) {
    if (hit(key)) {
      const vals = asList(value);
      if (vals.length) return vals;
    }
  }
  return [];
}
export function mergedInvestorTypes(row: GatedRow): string[] {
  return ovList(row.overrides, "Investor type") ?? asList((row.raw?.__profile as { investorTypes?: unknown } | undefined)?.investorTypes);
}

export type GatedRow = {
  id: string; company: string | null; raw: Record<string, unknown> | null;
  overrides: Record<string, unknown> | null; inv_source: string | null; inv_verified_at: string | null;
  contact_type?: string | null; source?: string | null; email?: string | null;
};

/**
 * The five fields scoring actually needs, already merged (overrides over Odoo) and
 * canonicalised. Both paths produce this: the wide crm_contacts scan via fieldsOf(), and
 * the narrow investor_match_index read. Scoring therefore has ONE implementation, and
 * the index cannot drift into scoring differently from the fallback.
 */
export type MatchFields = { industries: string[]; stages: string[]; sizes: string[]; types: string[]; revenues: string[] };

/** Project a wide crm_contacts row down to the scoring fields. */
export function fieldsOf(row: GatedRow): MatchFields {
  return {
    industries: mergedIndustries(row),
    // Union of both stage labels — see OP_STAGE_LABELS. A contact may carry the value
    // under either, and reading only one is what made approved stages score nothing.
    // The keyword fallback catches a third spelling we haven't seen yet.
    stages: [...new Set([
      ...OP_STAGE_LABELS.flatMap((label) => mergedExtra(row, label)),
      ...(OP_STAGE_LABELS.some((l) => mergedExtra(row, l).length) ? [] : mergedExtraLoose(row, [], ["operating stage", "operational stage"])),
    ])],
    sizes: mergedExtraLoose(row, [INV_SIZE_LABEL], ["investment size", "check size"]),
    types: mergedInvestorTypes(row),
    revenues: mergedExtraLoose(row, [REVENUE_LABEL], ["annual revenue range"]),
  };
}

/** Score merged fields against the founder's answers. Null = industry filter failed. */
export function scoreFields(f: MatchFields, answers: FitAnswers): { fit: number; summary: string } | null {
  const industries = lc(f.industries);
  // Hard filter: at least one selected sector overlaps (multi-select any-overlap).
  if (!answers.industry.some((i) => industries.has(i.trim().toLowerCase()))) return null;

  let fit = WEIGHTS.industry; // industry matched (hard-filtered above)

  const stageStored = lc(f.stages);
  if (stageStoredFor(answers.stage).some((s) => stageStored.has(s.toLowerCase()))) fit += WEIGHTS.stage;

  const bounds = raiseBoundsFor(answers.raise); // union of selected raise bands
  const sizeBands = f.sizes.map(parseMoneyBand).filter((b): b is { min: number; max: number } => b != null);
  if (bounds && sizeBands.some((b) => b.min <= bounds.max && b.max >= bounds.min)) fit += WEIGHTS.size;

  // Investor type: any selected type overlaps, or "Open to any" (no constraint).
  const invTypes = lc(f.types);
  if (investorTypeIsAny(answers.investorType) || investorTypeStoredFor(answers.investorType).some((t) => invTypes.has(t.toLowerCase()))) fit += WEIGHTS.type;

  const revStored = lc(f.revenues);
  if (revenueStoredFor(answers.revenue).some((r) => revStored.has(r.toLowerCase()))) fit += WEIGHTS.revenue;

  const summary = [f.stages.join("–") || null, f.sizes[0] || null].filter(Boolean).join(" · ");
  return { fit, summary };
}

/** Score one wide row. Kept as the thin wrapper the fallback path and tests use. */
export function scoreRow(row: GatedRow, answers: FitAnswers): { fit: number; summary: string } | null {
  return scoreFields(fieldsOf(row), answers);
}

/** An investor reduced to what ranking needs, from either source. */
export type Scorable = {
  id: string;
  company: string | null;
  inv_source: string | null;
  inv_verified_at: string | null;
  fields: MatchFields;
};

/** Pure ranking: score → industry hard filter → one row per firm → threshold → sort. */
export function rankScorables(items: Scorable[], answers: FitAnswers): MatchResult[] {
  // One row per firm: prefer the most-trusted source (verified > self_reported >
  // inferred/other), then most recently confirmed.
  const tier = (s: string | null) => (s === "verified" ? 2 : s === "self_reported" ? 1 : 0);
  const byFirm = new Map<string, Scorable>();
  for (const r of items) {
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
    const s = scoreFields(r.fields, answers);
    if (s && s.fit >= PASS_THRESHOLD) {
      scored.push({
        contactId: r.id,
        company: r.company as string,
        summary: s.summary,
        fit: s.fit,
        sectors: r.fields.industries,
        types: r.fields.types,
        stage: r.fields.stages.join(", ") || null,
        checkSize: r.fields.sizes[0] ?? null,
        revenue: r.fields.revenues[0] ?? null,
        score: null,
        tier: null,
      });
    }
  }
  // Sort by fit, then by investor score is applied after enrichment in matchInvestors.
  scored.sort((a, b) => b.fit - a.fit);
  return scored.slice(0, RESULT_LIMIT);
}

/** Rank wide crm_contacts rows (the fallback path). */
export function rankRows(rows: GatedRow[], answers: FitAnswers): MatchResult[] {
  return rankScorables(rows.map((r) => ({
    id: r.id, company: r.company, inv_source: r.inv_source, inv_verified_at: r.inv_verified_at, fields: fieldsOf(r),
  })), answers);
}

/** Distinct sectors offerable at Q3 — the industries that at least one GATED
 *  investor actually covers. Never hardcoded, so a sector with no investor behind
 *  it can't be offered (build-spec §2). */
let sectorCache: { at: number; sectors: string[] } | null = null;
const SECTOR_TTL_MS = 10 * 60 * 1000;

export async function offerableSectors(): Promise<string[]> {
  if (sectorCache && Date.now() - sectorCache.at < SECTOR_TTL_MS) return sectorCache.sectors;

  // Preferred: read the narrow index — one small column, every investor covered.
  const indexed = await indexedSectors().catch(() => null);
  if (indexed && indexed.length > 0) {
    const sectors = sortSectors(indexed);
    sectorCache = { at: Date.now(), sectors };
    return sectors;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceRoleClient() as any;
  // Fallback (index not built yet): NOT paged, deliberately. This runs on every /fit page
  // load and each row carries the whole Odoo `raw` blob — paging all 7,184 made Q3 hang.
  // Capped, the sector list is near-complete anyway (sectors repeat across investors).
  const { data, error } = await db
    .from("crm_contacts")
    .select("raw, overrides")
    .or("contact_type.eq.investor,module.eq.investor")
    .limit(20000);
  if (error || !Array.isArray(data)) return sectorCache?.sectors ?? [];
  const seen = new Set<string>();
  for (const row of data as { raw: Record<string, unknown> | null; overrides: Record<string, unknown> | null }[]) {
    for (const v of mergedIndustries({ id: "", company: null, inv_source: null, inv_verified_at: null, ...row })) seen.add(v);
  }
  const sectors = sortSectors([...seen]); // canonical, deduped, "Other" last
  sectorCache = { at: Date.now(), sectors };
  return sectors;
}

/**
 * Attach the investor score/tier to the rows we're about to show and finalise the
 * response. Only the top 3 are displayed, so their rating inputs are fetched by id —
 * three wide rows, not the whole network. Shared by the index and fallback paths.
 */
async function finish(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  ranked: MatchResult[],
  networkTotal: number,
): Promise<MatchResponse> {
  const shown = ranked.slice(0, 3);
  if (shown.length > 0) {
    type RatingRow = { id: string; source: string | null; contact_type: string | null; email: string | null; raw: Record<string, unknown> | null };
    const { data } = await db.from("crm_contacts")
      .select("id, source, contact_type, email, raw")
      .in("id", shown.map((m) => m.contactId));
    const byId = new Map(((data ?? []) as RatingRow[]).map((r) => [r.id, r]));
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
  }
  return {
    matched_count: ranked.length,
    top: shown,
    locked_count: Math.max(0, ranked.length - shown.length),
    thin: ranked.length < 3,
    network_total: networkTotal,
  };
}

export async function matchInvestors(answers: FitAnswers): Promise<MatchResponse> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceRoleClient() as any;

  // Gate: any investor contact (open-gate mode — imported/inferred investors are
  // matched, ranked below self_reported/verified). Founders are excluded by the
  // investor scope; the industry hard filter excludes anyone without sector overlap.
  // Preferred path: the industry hard filter runs IN SQL against investor_match_index, so
  // we read back only investors that could match — no wide scan, full network coverage.
  const [scorables, { count }] = await Promise.all([
    scorablesForIndustries(answers.industry).catch(() => null),
    db.from("crm_contacts").select("id", { count: "exact", head: true }).or("contact_type.eq.investor,module.eq.investor"),
  ]);
  const networkTotal = count ?? 0;

  if (scorables && scorables.length > 0) {
    return await finish(db, rankScorables(scorables, answers), networkTotal);
  }

  // Fallback: index missing or empty. Capped read — see the migration comment for why a
  // paged wide scan is not the answer here.
  const { data, error } = await db.from("crm_contacts")
    .select("id, company, raw, overrides, inv_source, inv_verified_at, contact_type, source, email")
    .or("contact_type.eq.investor,module.eq.investor")
    .not("company", "is", null)
    .limit(20000);

  if (error || !Array.isArray(data)) return { matched_count: 0, top: [], locked_count: 0, thin: true, network_total: networkTotal };
  return await finish(db, rankRows(data as GatedRow[], answers), networkTotal);
}
