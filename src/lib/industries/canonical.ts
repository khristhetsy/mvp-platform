/**
 * Canonical industry taxonomy — one source of truth for merging/renaming the messy
 * industry values that arrive from Odoo, applied at READ time everywhere industries
 * surface (the /fit sector list, the matcher, contact profiles, CRM facets). Read-time
 * mapping means an Odoo resync can't undo it and the stored data is never rewritten.
 */

// Lowercased raw value → canonical display label (merges + moves).
const MERGE: Record<string, string> = {
  "biote": "Biotechnology/Life Science",
  "internet": "Data/IoT",
  "technology/web": "Data/IoT",
  "information technology": "Data/IoT",
  "saas": "SaaS",
  "apps": "SaaS",
  "space tech": "Aerospace",
  "education": "EdTech",
};

// Values dropped entirely.
const REMOVE = new Set(["agnostic"]);

// Preferred spelling for values that vary only by case/format, so they de-dupe to one.
const CANON: Record<string, string> = {
  "saas": "SaaS",
  "fintech": "Fintech",
  "data/iot": "Data/IoT",
  "edtech": "EdTech",
  "aerospace": "Aerospace",
  "agtech": "AgTech",
  "biotechnology/life science": "Biotechnology/Life Science",
  "artificial intelligence": "Artificial Intelligence",
  "other": "Other",
};

/** Map one raw industry to its canonical label, or null if it should be dropped. */
export function canonicalizeIndustry(raw: string): string | null {
  const k = raw.trim().toLowerCase();
  if (!k) return null;
  if (REMOVE.has(k)) return null;
  if (MERGE[k]) return MERGE[k];
  return CANON[k] ?? raw.trim();
}

/** Canonicalize + de-dupe (case-insensitive) a list of industries. */
export function canonicalizeIndustries(list: string[]): string[] {
  const byKey = new Map<string, string>();
  for (const v of list) {
    const c = canonicalizeIndustry(v);
    if (c && !byKey.has(c.toLowerCase())) byKey.set(c.toLowerCase(), c);
  }
  return [...byKey.values()];
}

/** Sort alphabetically with "Other" always last. */
export function sortSectors(list: string[]): string[] {
  return [...list].sort((a, b) => {
    const ao = a.trim().toLowerCase() === "other" ? 1 : 0;
    const bo = b.trim().toLowerCase() === "other" ? 1 : 0;
    if (ao !== bo) return ao - bo;
    return a.localeCompare(b);
  });
}
