/**
 * Daily precompute of each founder's best investors.
 *
 * Reading the whole investor network once and scoring every founder against it gives each
 * founder their true top matches, where the live board only ever sees ~1,000 investors
 * (the database row cap). The result is stored per founder in founder_investor_matches
 * and read back by the board and automated outreach as a short list of contact ids.
 *
 * Off by default (platform setting `match_precompute`). Every reader falls back to the
 * old read when the stored list is missing, stale, or built from different founder
 * details or weights, so a board is never emptier than before.
 */
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { getBoolSetting, getInvestorMatchConfig } from "@/lib/settings/platform-settings";
import { loadInvestorContacts, type ScoredInvestorContact } from "@/lib/investors/load-investor-matches";
import { buildCompanyMatchProfile, scoreContactAgainstCompany } from "@/lib/matching/contact-match";

export const MATCH_PRECOMPUTE_KEY = "match_precompute";
/** Investors stored per founder. The board shows 50; outreach needs headroom for its minimums and exclusions. */
export const STORE_TOP = 200;
export const STORE_MAX_AGE_MS = 72 * 60 * 60 * 1000;
/** A run that read less than this share of the previous network size is a partial read and is not saved. */
export const MIN_NETWORK_SHARE = 0.8;

export type StoredMatch = { id: string; score: number };

/** The founder fields the matching engine reads. Anything else cannot change a ranking. */
const RANKING_KEYS = [
  "industry", "revenue_stage", "funding_stage", "operating_stage",
  "seeking_investor_types", "seeking_capital_types", "state", "country",
  "funding_amount", "funding_amount_band", "use_of_funds", "arr", "mrr",
  "review_status", "is_published", "marketplace_visible", "published_at",
] as const;

type Company = { id: string } & Record<string, unknown>;

export function rankingInputs(company: Record<string, unknown>): Record<string, string | number | boolean | null> {
  const out: Record<string, string | number | boolean | null> = {};
  for (const key of RANKING_KEYS) {
    const v = company[key];
    out[key] = v === undefined || v === null || v === "" ? null : typeof v === "string" ? v.trim() : typeof v === "number" || typeof v === "boolean" ? v : String(v);
  }
  return out;
}

/** Fingerprint of everything a stored ranking depends on: the founder's inputs and the engine weights. */
export function hashRankingInputs(company: Record<string, unknown>, weights: unknown): string {
  return createHash("sha1").update(JSON.stringify({ inputs: rankingInputs(company), weights })).digest("hex");
}

export function isFresh(computedAt: string, now: number = Date.now()): boolean {
  const iso = /[zZ]|[+-]\d\d:?\d\d$/.test(computedAt) ? computedAt : `${computedAt}Z`;
  const t = Date.parse(iso);
  return Number.isFinite(t) && t <= now + 5 * 60_000 && now - t <= STORE_MAX_AGE_MS;
}

/** Highest score first; equal scores by id so a rerun stores the same list. */
export function rankFounder<T extends { id: string }>(contacts: readonly T[], score: (c: T) => number, top: number = STORE_TOP): StoredMatch[] {
  return contacts
    .map((c) => ({ id: c.id, score: score(c) }))
    .sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : 1))
    .slice(0, top);
}

function db(): SupabaseClient {
  return createServiceRoleClient() as unknown as SupabaseClient;
}

type ScoreAgainst = NonNullable<Parameters<typeof loadInvestorContacts>[0]>["scoreAgainst"];

/**
 * The stored short list for one founder, loaded as contacts in stored order, or null when
 * the setting is off or the stored list cannot be trusted (callers then use the old read).
 */
export async function loadStoredInvestors(args: {
  company: Company;
  scoreAgainst: ScoreAgainst;
  /** Investors the caller needs to end up with. Fewer than this means fall back. */
  want: number;
  /** How many of the stored ids to load. */
  take: number;
}): Promise<ScoredInvestorContact[] | null> {
  try {
    if (!(await getBoolSetting(MATCH_PRECOMPUTE_KEY, false))) return null;
    const { data } = await db()
      .from("founder_investor_matches")
      .select("profile_hash, computed_at, matches")
      .eq("company_id", args.company.id)
      .maybeSingle();
    const row = data as { profile_hash: string; computed_at: string; matches: StoredMatch[] } | null;
    if (!row || !Array.isArray(row.matches)) return null;
    if (!isFresh(row.computed_at)) return null;
    const config = await getInvestorMatchConfig();
    if (row.profile_hash !== hashRankingInputs(args.company, config.engineWeights)) return null;
    const ids = row.matches.slice(0, args.take).map((m) => m.id);
    if (ids.length < args.want) return null;
    const rows = await loadInvestorContacts({ ids, scoreAgainst: args.scoreAgainst, investorsOnly: true, requireIndustryMatch: false, score: false });
    if (rows.length < args.want) return null;
    const position = new Map(ids.map((id, i) => [id, i]));
    return [...rows].sort((a, b) => (position.get(a.id) ?? 0) - (position.get(b.id) ?? 0));
  } catch {
    return null;
  }
}

export type PrecomputeSummary = {
  ok: boolean;
  error?: string;
  dryRun: boolean;
  founders: number;
  networkSize: number;
  readMs: number;
  scoreMs: number;
  writeMs: number;
  /** Mean score of each founder's best 50, averaged over founders. */
  avgTop50Score: number | null;
  written: number;
};

const empty = (dryRun: boolean, error: string, extra: Partial<PrecomputeSummary> = {}): PrecomputeSummary =>
  ({ ok: false, error, dryRun, founders: 0, networkSize: 0, readMs: 0, scoreMs: 0, writeMs: 0, avgTop50Score: null, written: 0, ...extra });

/** Read the whole network once, score every founder, and store each founder's best STORE_TOP. */
export async function computeFounderMatches(opts: { dryRun?: boolean } = {}): Promise<PrecomputeSummary> {
  const dryRun = Boolean(opts.dryRun);
  const client = db();

  const t0 = Date.now();
  const network = await loadInvestorContacts({ all: true, investorsOnly: true, score: false, requireIndustryMatch: false });
  const readMs = Date.now() - t0;
  if (network.length === 0) return empty(dryRun, "Could not read the investor network. Nothing was saved.", { readMs });

  // A page that fails returns nothing, so a short read only happens if the network really shrank.
  const { data: prev } = await client
    .from("founder_investor_matches")
    .select("network_size")
    .order("network_size", { ascending: false })
    .limit(1)
    .maybeSingle();
  const prevSize = (prev as { network_size?: number } | null)?.network_size ?? 0;
  if (prevSize > 0 && network.length < prevSize * MIN_NETWORK_SHARE) {
    return empty(dryRun, `The network read looks partial (${network.length} of about ${prevSize}). Nothing was saved.`, { networkSize: network.length, readMs });
  }

  const companies: Array<Record<string, unknown> & { id: string }> = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await client.from("companies").select("*").order("id", { ascending: true }).range(from, from + 999);
    if (error) return empty(dryRun, "Could not read founders. Nothing was saved.", { networkSize: network.length, readMs });
    companies.push(...((data ?? []) as Array<Record<string, unknown> & { id: string }>));
    if ((data ?? []).length < 1000) break;
  }

  const weights = (await getInvestorMatchConfig()).engineWeights;
  const t1 = Date.now();
  const computedAt = new Date().toISOString();
  const rows = companies.map((company) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const profile = buildCompanyMatchProfile(company as any);
    const matches = rankFounder(network, (s) => scoreContactAgainstCompany(s, profile, weights).matchScore);
    return { company_id: company.id, computed_at: computedAt, profile_hash: hashRankingInputs(company, weights), network_size: network.length, matches };
  });
  const scoreMs = Date.now() - t1;
  const tops = rows.map((r) => r.matches.slice(0, 50).reduce((sum, m) => sum + m.score, 0) / Math.max(1, Math.min(50, r.matches.length)));
  const avgTop50Score = tops.length ? Math.round((tops.reduce((a, b) => a + b, 0) / tops.length) * 10) / 10 : null;

  const base = { dryRun, founders: rows.length, networkSize: network.length, readMs, scoreMs, avgTop50Score };
  if (dryRun) return { ok: true, ...base, writeMs: 0, written: 0 };

  const t2 = Date.now();
  let written = 0;
  for (let i = 0; i < rows.length; i += 10) {
    const batch = rows.slice(i, i + 10);
    const { error } = await client.from("founder_investor_matches").upsert(batch, { onConflict: "company_id" });
    if (error) return { ok: false, error: `Could not save matches: ${error.message}`, ...base, writeMs: Date.now() - t2, written };
    written += batch.length;
  }
  return { ok: true, ...base, writeMs: Date.now() - t2, written };
}
