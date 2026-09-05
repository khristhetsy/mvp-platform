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

/**
 * Curated synonym → canonical merges for option values. Keyed by the trimmed,
 * lowercased variant; the value is the exact display spelling to keep. Applied
 * before case-dedupe, so aliases and casing collapse together. Stored contact
 * values are not rewritten — this only unifies the picker's option list.
 */
const VALUE_ALIASES: Record<string, string> = {
  "accredited individuals": "Angel Investor",
  "accredited individual": "Angel Investor",
  angels: "Angel Investor",
  angel: "Angel Investor",
};

/** Map a value through the alias table (case-insensitive), else return it unchanged. */
function canonicalizeValue(v: string): string {
  return VALUE_ALIASES[v.trim().toLowerCase()] ?? v;
}

/**
 * Pick the best spelling among case-only variants of the same option value
 * (e.g. "pre-series A" vs "Pre-Series A"): prefer an uppercase first letter,
 * then more uppercase letters overall, then alphabetical order for stability.
 */
function preferredSpelling(a: string, b: string): string {
  const upperFirst = (s: string) => /^[A-Z]/.test(s.trim());
  if (upperFirst(a) !== upperFirst(b)) return upperFirst(a) ? a : b;
  const uppers = (s: string) => (s.match(/[A-Z]/g) ?? []).length;
  if (uppers(a) !== uppers(b)) return uppers(a) > uppers(b) ? a : b;
  return a.localeCompare(b) <= 0 ? a : b;
}

/** Collapse case-only duplicates (keyed by trimmed+lowercased value) to one
 *  canonical spelling, then return sorted. Stored contact values are unaffected. */
function dedupeCanonical(set: Set<string>): string[] {
  const canonical = new Map<string, string>();
  for (const raw of set) {
    const v = canonicalizeValue(raw);
    const key = v.trim().toLowerCase();
    const existing = canonical.get(key);
    canonical.set(key, existing ? preferredSpelling(existing, v) : v);
  }
  return Array.from(canonical.values()).sort((a, b) => a.localeCompare(b));
}

/** Build the final option map: exact labels + canonical Odoo labels (keyword-matched). */
export function buildFieldOptions(byLabel: Map<string, Set<string>>): FieldOptions {
  const out: FieldOptions = {};
  const sort = (set: Set<string>) => dedupeCanonical(set);

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
const SELECT = "extra:raw->__profile->extra, industries:raw->__profile->industries, investorTypes:raw->__profile->investorTypes";

/** Curated option lists for fields that have no synced values yet (so the
 *  click-to-edit picker is a select, not a text box). Merged with — never
 *  replacing — any data-derived options for the same canonical label. */
const CURATED_OPTIONS: Record<string, string[]> = {
  "Investor preferences for the company with an ARR range of?": [
    "Less than $1M", "$1M – $5M", "$5M – $10M", "$10M – $25M", "$25M+",
  ],
  "Investor preferences for the company with an MRR range of?": [
    "Less than $80k", "$80k – $200k", "$200k – $400k", "$400k – $1M", "$1M+",
  ],
};

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
    const rows: Array<{ extra?: unknown; industries?: unknown; investorTypes?: unknown }> = [];
    for (let page = 0; page < MAX_PAGES; page++) {
      const from = page * PAGE;
      const { data, error } = await db.from("crm_contacts").select(SELECT).range(from, from + PAGE - 1);
      if (error || !data || data.length === 0) break;
      rows.push(...(data as Array<{ extra?: unknown; industries?: unknown; investorTypes?: unknown }>));
      if (data.length < PAGE) break;
    }
    const byLabel = aggregateExactLabels(rows);
    // Industries + Investor type live under semantic keys (__profile.industries /
    // __profile.investorTypes), not in extra — fold their distinct values into the
    // matching option sets so those fields are selects like the questionnaire ones.
    const indSet = byLabel.get("Industries") ?? new Set<string>();
    for (const row of rows) for (const v of normalizeValues(row.industries)) indSet.add(v);
    if (indSet.size) byLabel.set("Industries", indSet);

    const invTypeSet = byLabel.get("Investor type") ?? new Set<string>();
    for (const row of rows) for (const v of normalizeValues(row.investorTypes)) invTypeSet.add(v);
    if (invTypeSet.size) byLabel.set("Investor type", invTypeSet);

    const options = buildFieldOptions(byLabel);
    // Merge curated fallbacks (fields with no synced data yet) without clobbering data.
    for (const [label, opts] of Object.entries(CURATED_OPTIONS)) {
      options[label] = [...new Set([...(options[label] ?? []), ...opts])];
    }
    cache = { at: Date.now(), data: options };
    return options;
  } catch {
    return cache?.data ?? {};
  }
}
