// Distinct option values per profile field, for the click-to-edit selection
// pickers on a contact. The questionnaire answers live in
// crm_contacts.raw.__profile.extra as an array of { label, values }. The set of
// distinct values seen for a label across the population IS that field's option
// list (the fields are fixed Odoo selection / many2many pickers).
//
// Mirrors contact-facets: page crm_contacts once, aggregate in JS, cache. The
// result is keyed both by the exact synced label AND by the canonical Odoo label
// (via each schema field's match keyword) so a blank field — whose saveKey is the
// canonical label — still resolves to its options.

import { ALL_SCHEMA_FIELDS } from "@/lib/sales/contact-profile-sections";

export type FieldOptions = Record<string, string[]>;

function norm(s: string): string {
  return s.trim().toLowerCase();
}

// raw.__profile.extra is an OBJECT keyed by label; each value is a string,
// boolean, or array (possibly of [id, label] pairs). Mirrors flattenExtra in
// contacts.ts so options match what's displayed.
function normalizeValues(v: unknown): string[] {
  if (Array.isArray(v)) {
    return v.map((x) => (Array.isArray(x) && x.length === 2 ? String(x[1]) : String(x))).map((s) => s.trim()).filter(Boolean);
  }
  if (typeof v === "boolean") return [v ? "Yes" : "No"];
  if (v == null || v === "") return [];
  return [String(v).trim()].filter(Boolean);
}

/** Pure: fold rows of { extra: { label: value } } into distinct values per label. */
export function aggregateExactLabels(rows: Array<{ extra?: unknown }>): Map<string, Set<string>> {
  const byLabel = new Map<string, Set<string>>();
  for (const row of rows) {
    const extra = row.extra;
    if (!extra || typeof extra !== "object" || Array.isArray(extra)) continue;
    for (const [rawLabel, v] of Object.entries(extra as Record<string, unknown>)) {
      const label = rawLabel.trim();
      if (!label) continue;
      const values = normalizeValues(v);
      if (values.length === 0) continue;
      let set = byLabel.get(label);
      if (!set) { set = new Set(); byLabel.set(label, set); }
      for (const s of values) set.add(s);
    }
  }
  return byLabel;
}

/** Build the final option map: exact labels + canonical Odoo labels (keyword-matched). */
export function buildFieldOptions(byLabel: Map<string, Set<string>>): FieldOptions {
  const out: FieldOptions = {};
  const sort = (set: Set<string>) => Array.from(set).sort((a, b) => a.localeCompare(b));

  // 1) Exact synced labels resolve directly.
  for (const [label, set] of byLabel) out[label] = sort(set);

  // 2) Canonical Odoo labels: union values from any exact label matching the keyword.
  for (const f of ALL_SCHEMA_FIELDS) {
    const key = norm(f.match);
    const union = new Set<string>();
    for (const [label, set] of byLabel) {
      if (norm(label).includes(key)) for (const v of set) union.add(v);
    }
    if (union.size && !out[f.odoo]) out[f.odoo] = sort(union);
  }
  return out;
}

const PAGE = 1000;
const MAX_PAGES = 40; // ~40k rows safety cap
const SELECT = "extra:raw->__profile->extra";

let cache: { at: number; data: FieldOptions } | null = null;
const TTL_MS = 10 * 60 * 1000;

/**
 * Distinct option values per profile field across all contacts. Pages
 * crm_contacts, aggregates in JS, caches in-memory for TTL_MS. Pass force to
 * bypass the cache. Defensive: any failure yields an empty map.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getContactFieldOptions(db: any, force = false): Promise<FieldOptions> {
  if (!force && cache && Date.now() - cache.at < TTL_MS) return cache.data;
  try {
    const rows: Array<{ extra?: unknown }> = [];
    for (let page = 0; page < MAX_PAGES; page++) {
      const from = page * PAGE;
      const { data, error } = await db.from("crm_contacts").select(SELECT).range(from, from + PAGE - 1);
      if (error || !data || data.length === 0) break;
      rows.push(...(data as Array<{ extra?: unknown }>));
      if (data.length < PAGE) break;
    }
    const options = buildFieldOptions(aggregateExactLabels(rows));
    cache = { at: Date.now(), data: options };
    return options;
  } catch {
    return cache?.data ?? {};
  }
}
