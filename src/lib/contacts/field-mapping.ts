// Contact import field mapping. A file's columns are matched to iCapOS contact fields;
// anything that doesn't match waits for staff to choose a field, create a custom field,
// or skip it. Values are stored as received: mapping only decides where they land.
//
// Saved decisions live in contact_field_mappings (one row per source + column), custom
// fields in contact_custom_fields. Custom values are written to raw.__profile.extra by
// label, the same place Odoo's Studio fields go, so the contact profile shows them under
// Details and the crm_contacts_sync_profile trigger folds them into `profile`.

export type MappingSource = "csv" | "xlsx";
export const MAPPING_SOURCES: MappingSource[] = ["csv", "xlsx"];
export const SOURCE_LABEL: Record<MappingSource, string> = { csv: "CSV import", xlsx: "Excel import" };

export type TargetField = {
  key: string;
  label: string;
  group: "Contact" | "Company";
  /** Header spellings that match this field without asking. Lowercased, trimmed. */
  aliases: string[];
};

/**
 * crm_contacts text columns an import may write. All are plain text, so a value lands
 * exactly as received. Array or enum-like columns (tags, assignees, lead status) are not
 * offered: mapping into them would change the value's format.
 */
export const TARGET_FIELDS: TargetField[] = [
  { key: "name", label: "Name", group: "Contact", aliases: ["name", "full name", "contact", "contact name"] },
  { key: "email", label: "Email", group: "Contact", aliases: ["email", "e-mail", "email address", "work email", "mail"] },
  { key: "phone", label: "Phone", group: "Contact", aliases: ["phone", "mobile", "tel", "telephone", "cell", "phone number"] },
  { key: "country", label: "Country", group: "Contact", aliases: ["country", "country name"] },
  { key: "contact_type", label: "Contact type", group: "Contact", aliases: ["type", "role", "contact type", "membership", "membership type"] },
  { key: "stage", label: "Stage", group: "Contact", aliases: ["stage"] },
  { key: "company", label: "Company", group: "Company", aliases: ["company", "company name", "organization", "organisation", "org", "account", "employer", "firm"] },
  { key: "website", label: "Website", group: "Company", aliases: ["website", "url", "site", "web"] },
  { key: "company_domain", label: "Company domain", group: "Company", aliases: ["domain", "company domain"] },
];

export const TARGET_KEYS = TARGET_FIELDS.map((f) => f.key);

export type MappingAction = "map" | "custom" | "ignore";

/** One column's decision. `customLabel` names a custom field to create when it doesn't exist yet. */
export type ColumnMapping = {
  column: string;
  action: MappingAction;
  target?: string | null;
  customKey?: string | null;
  customLabel?: string | null;
};

export type SavedMapping = { source_column: string; action: MappingAction; target_field: string | null; custom_key: string | null };
export type CustomField = { key: string; label: string };

export type MatchStatus = "saved" | "exact" | "alias" | "none";
export type ColumnMatch = ColumnMapping & { status: MatchStatus; samples: string[] };

/** Lowercase, trim and collapse spacing and separators. Pure. */
export function normHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[_\-.]+/g, " ").replace(/\s+/g, " ");
}

/** A stable custom field key from a label: lowercase letters, digits and underscores. Pure. */
export function customKeyOf(label: string): string {
  const k = label.trim().toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const base = /^[a-z]/.test(k) ? k : `f_${k}`;
  return base.slice(0, 63) || "field";
}

/**
 * Auto-match each column, in order: a saved decision for this source, the field's own
 * key or label, then a known alias. Anything else is "none" and needs a decision.
 * A target already taken by an earlier column is not matched twice. Pure.
 */
export function autoMatch(columns: string[], saved: SavedMapping[], sampleRows: string[][] = []): ColumnMatch[] {
  const savedBy = new Map(saved.map((s) => [s.source_column, s]));
  const taken = new Set<string>();
  const samplesFor = (i: number) => {
    const out: string[] = [];
    for (const r of sampleRows) {
      const v = (r[i] ?? "").trim();
      if (v && !out.includes(v)) out.push(v);
      if (out.length >= 3) break;
    }
    return out;
  };
  return columns.map((column, i) => {
    const samples = samplesFor(i);
    const s = savedBy.get(column);
    if (s) {
      if (s.action === "map" && s.target_field && !taken.has(s.target_field) && TARGET_KEYS.includes(s.target_field)) {
        taken.add(s.target_field);
        return { column, action: "map", target: s.target_field, status: "saved", samples };
      }
      if (s.action === "custom" && s.custom_key) return { column, action: "custom", customKey: s.custom_key, status: "saved", samples };
      if (s.action === "ignore") return { column, action: "ignore", status: "saved", samples };
    }
    const h = normHeader(column);
    const exact = TARGET_FIELDS.find((f) => !taken.has(f.key) && (normHeader(f.key) === h || normHeader(f.label) === h));
    if (exact) { taken.add(exact.key); return { column, action: "map", target: exact.key, status: "exact", samples }; }
    const alias = TARGET_FIELDS.find((f) => !taken.has(f.key) && f.aliases.includes(h));
    if (alias) { taken.add(alias.key); return { column, action: "map", target: alias.key, status: "alias", samples }; }
    return { column, action: "ignore", status: "none", samples };
  });
}

export type MappingProblem = { column?: string; message: string };

/**
 * Check a full mapping before import. `decided` lists the columns staff resolved in the
 * review, so an unmatched column only passes once someone chose for it. Pure.
 */
export function validateMapping(columns: string[], mapping: ColumnMapping[], customKeys: string[], decided?: Set<string>): MappingProblem[] {
  const problems: MappingProblem[] = [];
  const byCol = new Map(mapping.map((m) => [m.column, m]));
  const used = new Map<string, string>();
  for (const c of columns) {
    const m = byCol.get(c);
    if (!m) { problems.push({ column: c, message: "Choose a field or skip this column." }); continue; }
    if (decided && !decided.has(c)) { problems.push({ column: c, message: "Choose a field or skip this column." }); continue; }
    if (m.action === "map") {
      if (!m.target || !TARGET_KEYS.includes(m.target)) problems.push({ column: c, message: "Unknown field." });
      else if (used.has(m.target)) problems.push({ column: c, message: `"${used.get(m.target)}" already goes to this field.` });
      else used.set(m.target, c);
    } else if (m.action === "custom") {
      const ok = (m.customKey && customKeys.includes(m.customKey)) || (m.customLabel && m.customLabel.trim());
      if (!ok) problems.push({ column: c, message: "Name the custom field." });
    }
  }
  if (!used.has("name")) problems.push({ message: "Map one column to Name. Every contact needs a name." });
  return problems;
}

/**
 * Contact type is the one classification column: Founders, Investors and Advisors group on
 * it (contact_role), so it keeps today's import rule. The text as received is still kept
 * in raw.import.row. Pure.
 */
export function contactTypeOf(v: string): "founder" | "investor" | "advisor" | "other" {
  const t = v.trim().toLowerCase();
  if (t.startsWith("found") || t.startsWith("entre")) return "founder";
  if (t.startsWith("inv")) return "investor";
  if (t.startsWith("adv")) return "advisor";
  return "other";
}

export type MappedRow = {
  fields: Record<string, string>;
  custom: Record<string, string>;
};

/**
 * Apply a mapping to raw rows. Values keep their exact text; only surrounding whitespace
 * from the file is removed, and empty cells are left out. Contact type is classified (see
 * contactTypeOf). Custom values are keyed by the custom field's label. Pure.
 */
export function applyMapping(columns: string[], rows: string[][], mapping: ColumnMapping[], customLabels: Record<string, string>): MappedRow[] {
  const plan = columns.map((c) => mapping.find((m) => m.column === c) ?? null);
  return rows.map((r) => {
    const out: MappedRow = { fields: {}, custom: {} };
    plan.forEach((m, i) => {
      if (!m || m.action === "ignore") return;
      const v = (r[i] ?? "").trim();
      if (!v) return;
      if (m.action === "map" && m.target) out.fields[m.target] = m.target === "contact_type" ? contactTypeOf(v) : v;
      else if (m.action === "custom") {
        const label = (m.customKey && customLabels[m.customKey]) || m.customLabel?.trim();
        if (label) out.custom[label] = v;
      }
    });
    return out;
  });
}

/** RFC 4180 CSV into rows of cells, values untouched. Pure. */
export function parseCsvCells(text: string): string[][] {
  const lines: string[][] = [];
  let cur: string[] = [], field = "", inQ = false;
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQ) { if (ch === '"') { if (src[i + 1] === '"') { field += '"'; i++; } else inQ = false; } else field += ch; continue; }
    if (ch === '"') inQ = true;
    else if (ch === ",") { cur.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") { if (ch === "\r" && src[i + 1] === "\n") i++; cur.push(field); lines.push(cur); cur = []; field = ""; }
    else field += ch;
  }
  if (field || cur.length) { cur.push(field); lines.push(cur); }
  return lines.filter((l) => l.some((c) => c.trim()));
}

/** Split parsed cells into a header and data rows, dropping blank header cells' empty names. Pure. */
export function splitHeader(cells: string[][]): { columns: string[]; rows: string[][] } {
  const [head = [], ...rows] = cells;
  const columns = head.map((h, i) => h.trim() || `Column ${i + 1}`);
  return { columns, rows };
}
