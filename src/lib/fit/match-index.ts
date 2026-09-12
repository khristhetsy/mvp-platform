/**
 * Builder + reader for investor_match_index — the narrow projection /fit matches against.
 *
 * Why a derived table at all: crm_contacts rows carry the entire Odoo `raw` jsonb, so any
 * full scan of the investor network moves tens of megabytes. Capping that read left /fit
 * ranking against ~1,000 of 7,184 investors; paging it hung the page. The index holds only
 * the five scoring fields, so the industry hard filter runs in SQL (GIN + &&) and matching
 * reads back only investors that could actually match — usually a few dozen rows.
 *
 * The projection is built HERE, in TypeScript, reusing the same merge helpers the matcher
 * uses. Reimplementing the overrides-beat-Odoo rules and industry canonicalisation in
 * PL/pgSQL would give us two definitions of a match that could silently diverge.
 *
 * The index is a cache: stale by at most one rebuild, and safe to truncate.
 */
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { readAllRows, chunk } from "@/lib/supabase/paged";
import { fieldsOf, type GatedRow, type Scorable } from "@/lib/fit/match-investors";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any { return createServiceRoleClient(); }

export type IndexRow = {
  contact_id: string;
  company: string;
  company_key: string;
  industries: string[];
  stages: string[];
  sizes: string[];
  types: string[];
  revenues: string[];
  inv_source: string | null;
  inv_verified_at: string | null;
  updated_at: string;
};

/**
 * Project one wide row into an index row. Pure.
 *
 * Returns null for anything unmatchable, so the index stays small: no company (the matcher
 * skips those in firm de-dup) or no industries (the hard filter would exclude them from
 * every search anyway).
 */
export function toIndexRow(row: GatedRow, now = new Date().toISOString()): IndexRow | null {
  const company = (row.company ?? "").trim();
  if (!company) return null;
  const f = fieldsOf(row);
  if (f.industries.length === 0) return null;
  return {
    contact_id: row.id,
    company,
    company_key: company.toLowerCase(),
    industries: f.industries,
    stages: f.stages,
    sizes: f.sizes,
    types: f.types,
    revenues: f.revenues,
    inv_source: row.inv_source,
    inv_verified_at: row.inv_verified_at,
    updated_at: now,
  };
}

/**
 * Rebuild the whole index from crm_contacts. Paged and chunked — this is a background job
 * where the wide read is fine, precisely so the request path never has to do it.
 */
export async function rebuildMatchIndex(opts: { full?: boolean } = {}): Promise<{ scanned: number; written: number; removed: number; mode: "full" | "incremental" }> {
  // Incremental by default. A full reprojection reads every investor's `raw` jsonb, which
  // is CPU-expensive enough to matter on small compute — and running it on every contacts
  // sync (six times a day) is pure waste when only a few contacts changed. So unless a
  // full rebuild is asked for, only reproject contacts touched since the last run.
  let since: string | null = null;
  if (!opts.full) {
    const { data } = await db().from("investor_match_index")
      .select("updated_at").order("updated_at", { ascending: false }).limit(1).maybeSingle();
    since = (data?.updated_at as string | undefined) ?? null;
  }
  const mode: "full" | "incremental" = since ? "incremental" : "full";

  const rows = await readAllRows<GatedRow>((from, to) => {
    let q = db().from("crm_contacts")
      .select("id, company, raw, overrides, inv_source, inv_verified_at")
      .or("contact_type.eq.investor,module.eq.investor")
      .not("company", "is", null);
    // Change detection uses synced_at: crm_contacts has NO updated_at column, and asking
    // for one made the whole read error out. Caveat worth knowing: synced_at only moves
    // when the connector re-syncs a contact, so edits made HERE (an approved enrichment,
    // the job-title backfill) do not bump it. Those need a full rebuild — which is why
    // the admin card offers one.
    if (since) q = q.gt("synced_at", since);
    return q.order("id", { ascending: true }).range(from, to);
  });

  const now = new Date().toISOString();
  const indexRows = rows.map((r) => toIndexRow(r, now)).filter((r): r is IndexRow => r !== null);

  let written = 0;
  for (const part of chunk(indexRows, 500)) {
    const { error } = await db().from("investor_match_index").upsert(part, { onConflict: "contact_id" });
    if (!error) written += part.length;
  }

  // Prune only on a FULL rebuild. "Anything untouched is stale" is only true when every
  // contact was reprojected — on an incremental pass it would delete the entire index.
  let removed = 0;
  if (mode === "full") {
    const { data: removedRows } = await db().from("investor_match_index")
      .delete().lt("updated_at", now).select("contact_id");
    removed = (removedRows ?? []).length;
  }
  return { scanned: rows.length, written, removed, mode };
}

/**
 * Investors whose sectors overlap the founder's answers — the industry hard filter, run in
 * the database. Returns Scorables ready for rankScorables().
 */
export async function scorablesForIndustries(industries: string[]): Promise<Scorable[] | null> {
  if (industries.length === 0) return [];
  const { data, error } = await db().from("investor_match_index")
    .select("contact_id, company, industries, stages, sizes, types, revenues, inv_source, inv_verified_at")
    .overlaps("industries", industries)
    .limit(5000);
  // null (not []) signals "index unusable" so the caller can fall back to the wide scan
  // rather than silently returning no matches.
  if (error) return null;
  return ((data ?? []) as IndexRow[]).map((r) => ({
    id: r.contact_id,
    company: r.company,
    inv_source: r.inv_source,
    inv_verified_at: r.inv_verified_at,
    fields: {
      industries: r.industries ?? [], stages: r.stages ?? [], sizes: r.sizes ?? [],
      types: r.types ?? [], revenues: r.revenues ?? [],
    },
  }));
}

/** Distinct sectors present in the index — the Q3 option list, without a wide scan. */
export async function indexedSectors(): Promise<string[] | null> {
  const rows = await readAllRows<{ industries: string[] }>((from, to) => db()
    .from("investor_match_index").select("industries").order("contact_id", { ascending: true }).range(from, to));
  if (rows.length === 0) return null;   // empty/not built → caller falls back
  const seen = new Set<string>();
  for (const r of rows) for (const s of r.industries ?? []) seen.add(s);
  return [...seen];
}

/** Row count, for the admin readout. */
export async function matchIndexSize(): Promise<number> {
  const { count } = await db().from("investor_match_index").select("contact_id", { count: "exact", head: true });
  return count ?? 0;
}
