// Shared contact-list filter application. Used by the list endpoint, the group-count
// facets endpoint, and the bulk-assign endpoint so "select all matching" targets
// exactly the rows the list shows. Keep this the single source of truth for filters.

// Questionnaire facets stored as jsonb arrays under raw.__profile.<key>; filtered via
// jsonb containment (@>). Values within a facet are OR'd; different facets are AND'd.
export const FACET_KEYS = ["industries", "capital", "fundingStages", "investorTypes", "operatingStages"] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyFacetFilters(query: any, p: URLSearchParams): any {
  for (const key of FACET_KEYS) {
    const vals = p.getAll(key).map((s) => s.trim()).filter((v) => v && !v.includes(",") && !v.includes('"'));
    if (!vals.length) continue;
    query = query.or(vals.map((v) => `raw->__profile->${key}.cs.["${v}"]`).join(","));
  }
  return query;
}

// Global search + per-column contains + country + facets. Mirrors the Contacts list.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyContactFilters(query: any, p: URLSearchParams): any {
  const q = p.get("q")?.trim();
  if (q) query = query.or(`name.ilike.%${q}%,email.ilike.%${q}%,company.ilike.%${q}%,phone.ilike.%${q}%`);
  for (const col of ["name", "company", "email", "phone"]) {
    const v = p.get(col)?.trim();
    if (v) query = query.ilike(col, `%${v}%`);
  }
  const countries = p.get("country")?.split(",").map((s) => s.trim()).filter(Boolean);
  if (countries && countries.length) query = query.in("country", countries);
  query = applyFacetFilters(query, p);
  return query;
}
