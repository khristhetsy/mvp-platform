// Contact finder — lookup log (spec 5.1, 5.3). One row per source attempt, so the
// find rate per source is measured from iCFO's own lookups, not vendor claims.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export const LOOKUP_SOURCES = ["domain_pattern", "site", "web", "pattern", "manual_kaspr", "manual_apollo", "manual_other"] as const;
export type LookupSource = (typeof LOOKUP_SOURCES)[number];
export type LookupOutcome = "found" | "not_found" | "error" | "skipped_suppressed" | "skipped_budget";

export interface LookupRow {
  contact_id: string;
  source: LookupSource;
  field: "email" | "phone";
  outcome: LookupOutcome;
  value?: string | null;
  run_by?: string | null;
}

export const SOURCE_LABEL: Record<LookupSource, string> = {
  domain_pattern: "Company format (learned)",
  site: "Company website",
  web: "Web search → company pages",
  pattern: "Format guess",
  manual_kaspr: "Kaspr (manual)",
  manual_apollo: "Apollo (manual)",
  manual_other: "Other (manual)",
};

/** Write lookup rows. Best effort: a logging failure never breaks a lookup. */
export async function logLookups(db: Db, rows: LookupRow[]): Promise<void> {
  if (rows.length === 0) return;
  try {
    await db.from("contact_lookups").insert(rows.map((r) => ({ ...r, value: r.value ?? null, run_by: r.run_by ?? null })));
  } catch {
    /* logging is best effort */
  }
}

export interface SourceStat { source: LookupSource; label: string; found: number; notFound: number; attempts: number; rate: number | null }

/** found / (found + not_found) per source. Skips and errors are not attempts. */
export function findRates(rows: Array<{ source: string; outcome: string }>): SourceStat[] {
  const by = new Map<string, { found: number; notFound: number }>();
  for (const r of rows) {
    if (r.outcome !== "found" && r.outcome !== "not_found") continue;
    const s = by.get(r.source) ?? { found: 0, notFound: 0 };
    if (r.outcome === "found") s.found++; else s.notFound++;
    by.set(r.source, s);
  }
  return LOOKUP_SOURCES.filter((s) => by.has(s)).map((source) => {
    const { found, notFound } = by.get(source)!;
    const attempts = found + notFound;
    return { source, label: SOURCE_LABEL[source], found, notFound, attempts, rate: attempts ? found / attempts : null };
  });
}

export interface FinderStats {
  sinceIso: string;
  days: number;
  lookups: number;
  contactsLookedUp: number;
  bySource: SourceStat[];
  pendingSuggestions: number;
  acceptedSuggestions: number;
  rejectedSuggestions: number;
}

/** Stats for the last `days` days, straight from contact_lookups and contact_finder_suggestions. */
export async function getFinderStats(db: Db, days = 30): Promise<FinderStats> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const rows: Array<{ contact_id: string; source: string; outcome: string }> = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("contact_lookups").select("contact_id, source, outcome").gte("created_at", since).order("created_at").range(from, from + 999);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as typeof rows));
    if ((data ?? []).length < 1000) break;
  }
  const count = async (status: string) => {
    const { count: n, error: e } = await db.from("contact_finder_suggestions").select("id", { count: "exact", head: true }).eq("status", status).gte("created_at", since);
    if (e) throw new Error(e.message);
    return n ?? 0;
  };
  const [pending, accepted, rejected] = await Promise.all([count("pending"), count("accepted"), count("rejected")]);
  return {
    sinceIso: since,
    days,
    lookups: rows.length,
    contactsLookedUp: new Set(rows.map((r) => r.contact_id)).size,
    bySource: findRates(rows),
    pendingSuggestions: pending,
    acceptedSuggestions: accepted,
    rejectedSuggestions: rejected,
  };
}
