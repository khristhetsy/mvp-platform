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
import { parseMoneyBand } from "@/lib/investors/preference-match";
import {
  OP_STAGE_LABEL,
  INV_SIZE_LABEL,
  REVENUE_LABEL,
  stageStoredFor,
  raiseBoundsFor,
  revenueStoredFor,
  type FitAnswers,
} from "@/lib/fit/options";

const PASS_THRESHOLD = 70;
const VERIFIED_WINDOW_DAYS = 180;
const RESULT_LIMIT = 25;

export type MatchResult = { company: string; summary: string; fit: number };
export type MatchResponse = {
  matched_count: number;
  top: MatchResult[];
  locked_count: number;
  thin: boolean;
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

type GatedRow = { id: string; company: string | null; raw: Record<string, unknown> | null; inv_source: string; inv_verified_at: string | null };

/** Score one investor row against the founder's answers. Returns null when the
 *  industry hard filter fails (no sector overlap → never shown). */
export function scoreRow(row: GatedRow, answers: FitAnswers): { fit: number; summary: string } | null {
  const raw = row.raw;
  const industries = lc(asList((raw?.__profile as { industries?: unknown } | undefined)?.industries));
  if (!industries.has(answers.industry.trim().toLowerCase())) return null; // hard filter

  let fit = 35; // industry matched (hard-filtered above)

  const stageStored = lc(extraValues(raw, OP_STAGE_LABEL));
  if (stageStoredFor(answers.stage).some((s) => stageStored.has(s.toLowerCase()))) fit += 30;

  const bounds = raiseBoundsFor(answers.raise);
  const sizeBands = extraValues(raw, INV_SIZE_LABEL).map(parseMoneyBand).filter((b): b is { min: number; max: number } => b != null);
  if (bounds && sizeBands.some((b) => b.min <= bounds.max && b.max >= bounds.min)) fit += 25;

  const revStored = lc(extraValues(raw, REVENUE_LABEL));
  if (revenueStoredFor(answers.revenue).some((r) => revStored.has(r.toLowerCase()))) fit += 10;

  const summary = [
    extraValues(raw, OP_STAGE_LABEL).join("–") || null,
    extraValues(raw, INV_SIZE_LABEL)[0] || null,
  ].filter(Boolean).join(" · ");

  return { fit, summary };
}

/** Pure ranking: score → industry hard filter → one row per firm → threshold → sort. */
export function rankRows(rows: GatedRow[], answers: FitAnswers): MatchResult[] {
  // One row per firm: prefer verified, then most recently confirmed.
  const byFirm = new Map<string, GatedRow>();
  for (const r of rows) {
    if (!r.company) continue;
    const key = r.company.trim().toLowerCase();
    const cur = byFirm.get(key);
    if (!cur) { byFirm.set(key, r); continue; }
    const better =
      (r.inv_source === "verified" ? 0 : 1) - (cur.inv_source === "verified" ? 0 : 1) < 0 ||
      ((r.inv_source === "verified") === (cur.inv_source === "verified") &&
        (r.inv_verified_at ?? "") > (cur.inv_verified_at ?? ""));
    if (better) byFirm.set(key, r);
  }

  const scored: MatchResult[] = [];
  for (const r of byFirm.values()) {
    const s = scoreRow(r, answers);
    if (s && s.fit >= PASS_THRESHOLD) scored.push({ company: r.company as string, summary: s.summary, fit: s.fit });
  }
  scored.sort((a, b) => b.fit - a.fit);
  return scored.slice(0, RESULT_LIMIT);
}

/** Distinct sectors offerable at Q3 — the industries that at least one GATED
 *  investor actually covers. Never hardcoded, so a sector with no investor behind
 *  it can't be offered (build-spec §2). */
export async function offerableSectors(): Promise<string[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceRoleClient() as any;
  const cutoff = new Date(Date.now() - VERIFIED_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await db
    .from("crm_contacts")
    .select("raw")
    .in("inv_source", ["self_reported", "verified"])
    .gt("inv_verified_at", cutoff)
    .limit(5000);
  if (error || !Array.isArray(data)) return [];
  const seen = new Set<string>();
  for (const row of data as { raw: Record<string, unknown> | null }[]) {
    for (const v of asList((row.raw?.__profile as { industries?: unknown } | undefined)?.industries)) seen.add(v);
  }
  return [...seen].sort((a, b) => a.localeCompare(b));
}

export async function matchInvestors(answers: FitAnswers): Promise<MatchResponse> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = createServiceRoleClient() as any;
  const cutoff = new Date(Date.now() - VERIFIED_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // Safety gate at the query level: inferred / stale contacts never fetched.
  const { data, error } = await db
    .from("crm_contacts")
    .select("id, company, raw, inv_source, inv_verified_at")
    .in("inv_source", ["self_reported", "verified"])
    .gt("inv_verified_at", cutoff)
    .not("company", "is", null)
    .limit(5000);

  if (error || !Array.isArray(data)) return { matched_count: 0, top: [], locked_count: 0, thin: true };

  const ranked = rankRows(data as GatedRow[], answers);
  return {
    matched_count: ranked.length,
    top: ranked.slice(0, 3),
    locked_count: Math.max(0, ranked.length - 3),
    thin: ranked.length < 3,
  };
}
