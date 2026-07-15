// Distinct option values per questionnaire facet, for the Contacts Filters dropdown.
//
// History: this used a Postgres function (contact_filter_facets) called via
// PostgREST .rpc(). In production the function exists and returns data in SQL,
// but PostgREST's schema cache would not register it (repeated reloads didn't
// take), so .rpc() returned empty and the dropdown showed "No options".
//
// This implementation removes that fragility: it reads the raw->__profile arrays
// straight off crm_contacts via .from().select() (always in the schema cache) and
// aggregates distinct values in JS. Results are cached in-memory so the paging
// scan only runs occasionally. The .rpc() path is kept as a fast path when it
// happens to work, but we no longer depend on it.

export type ContactFacets = {
  industries: string[];
  capital: string[];
  fundingStages: string[];
  investorTypes: string[];
  operatingStages: string[];
};

export const FACET_KEYS = ["industries", "capital", "fundingStages", "investorTypes", "operatingStages"] as const;
export type FacetKey = (typeof FACET_KEYS)[number];

const EMPTY: ContactFacets = { industries: [], capital: [], fundingStages: [], investorTypes: [], operatingStages: [] };

/** Pure: fold rows of {facetKey: string[] | null} into sorted distinct value lists. Unit-tested. */
export function aggregateFacetRows(rows: Array<Record<string, unknown>>): ContactFacets {
  const sets: Record<FacetKey, Set<string>> = {
    industries: new Set(), capital: new Set(), fundingStages: new Set(), investorTypes: new Set(), operatingStages: new Set(),
  };
  for (const row of rows) {
    for (const key of FACET_KEYS) {
      const v = row[key];
      if (!Array.isArray(v)) continue;
      for (const item of v) {
        const s = typeof item === "string" ? item.trim() : String(item ?? "").trim();
        if (s) sets[key].add(s);
      }
    }
  }
  const out = { ...EMPTY };
  for (const key of FACET_KEYS) out[key] = Array.from(sets[key]).sort((a, b) => a.localeCompare(b));
  return out;
}

function isNonEmpty(f: ContactFacets | null | undefined): f is ContactFacets {
  return !!f && FACET_KEYS.some((k) => (f[k]?.length ?? 0) > 0);
}

const PAGE = 1000;
const MAX_PAGES = 60; // safety cap (~60k rows)
const SELECT = FACET_KEYS.map((k) => `${k}:raw->__profile->${k}`).join(", ");

// Module-level cache — facet options change rarely (only when Odoo data re-syncs).
let cache: { at: number; data: ContactFacets } | null = null;
const TTL_MS = 10 * 60 * 1000;

/**
 * Distinct facet options across all contacts. Tries the SQL function first (fast
 * when the PostgREST cache has it); otherwise pages crm_contacts and aggregates.
 * Cached in-memory for TTL_MS. Pass force to bypass the cache.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getContactFilterFacets(db: any, force = false): Promise<ContactFacets> {
  if (!force && cache && Date.now() - cache.at < TTL_MS) return cache.data;

  // Fast path: the RPC, if PostgREST can see it.
  try {
    const { data } = await db.rpc("contact_filter_facets");
    if (data && typeof data === "object") {
      const f: ContactFacets = {
        industries: Array.isArray(data.industries) ? data.industries : [],
        capital: Array.isArray(data.capital) ? data.capital : [],
        fundingStages: Array.isArray(data.fundingStages) ? data.fundingStages : [],
        investorTypes: Array.isArray(data.investorTypes) ? data.investorTypes : [],
        operatingStages: Array.isArray(data.operatingStages) ? data.operatingStages : [],
      };
      if (isNonEmpty(f)) { cache = { at: Date.now(), data: f }; return f; }
    }
  } catch { /* fall through to direct computation */ }

  // Reliable path: read raw->__profile arrays directly and aggregate.
  const rows: Array<Record<string, unknown>> = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * PAGE;
    const { data, error } = await db
      .from("crm_contacts")
      .select(SELECT)
      .range(from, from + PAGE - 1);
    if (error || !data || data.length === 0) break;
    rows.push(...(data as Array<Record<string, unknown>>));
    if (data.length < PAGE) break;
  }
  const facets = aggregateFacetRows(rows);
  cache = { at: Date.now(), data: facets };
  return facets;
}
