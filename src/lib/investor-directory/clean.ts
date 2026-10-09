/**
 * Cleaning for directory imports. Pure, so it is unit tested and runs the same
 * in the admin import route and in scripts.
 *
 * Every import: parse the CSV, map its headers, normalize names, emails and
 * phones, flag bad email formats, map public labels onto the platform's own
 * option lists, and merge duplicates by email (then by firm + contact).
 */

export type CleanRow = {
  firm: string;
  contact_name: string | null;
  title: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  city: string | null;
  state: string | null;
  investor_types: string[];
  funding_stages: string[];
  capital_types: string[];
  industries: string[];
  fund_name: string | null;
  fund_size: number | null;
  avg_investment: number | null;
  strategy: string | null;
  investing_now: boolean | null;
};

export type CleanResult = {
  rows: CleanRow[];
  rowCount: number;
  merged: number;
  invalidEmails: number;
  skipped: number;
};

/** RFC 4180 style CSV: quoted fields, escaped quotes, commas and newlines inside quotes. */
export function parseCsv(text: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const s = text.replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quoted) {
      if (ch === '"') {
        if (s[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && s[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((c) => c.trim() !== "")) out.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== "")) out.push(row);
  return out;
}

const HEADER_ALIASES: Record<string, string[]> = {
  firm: ["firm", "manager", "company", "organization", "organization name", "firm name", "investor firm"],
  contact_name: ["contact", "contact name", "name", "full name", "investor relations name", "investor name"],
  title: ["title", "job title", "role"],
  email: ["email", "email address", "investor relations email", "e-mail"],
  phone: ["phone", "phone number", "investor relations phone", "telephone"],
  website: ["website", "url", "web", "site"],
  city: ["city"],
  state: ["state", "region"],
  investor_types: ["investor types"],
  funding_stages: ["funding stages", "stages", "stage"],
  capital_types: ["capital", "capital types", "capital type"],
  industries: ["industries", "industry", "sectors", "sector"],
  fund_name: ["fund", "fund name", "latest fund", "name of fund"],
  fund_size: ["fund size", "fund size ($)"],
  avg_investment: ["average investment", "avg investment", "avg investment ($)", "average check"],
  strategy: ["strategy", "investment strategy", "stage or strategy"],
  investing_now: ["investing now", "making new investments?", "making new investments"],
  type: ["type", "investor type", "investor category"],
  style: ["style", "fund style"],
};

export function mapHeaders(headers: string[]): Map<string, number> {
  const norm = headers.map((h) => h.trim().toLowerCase().replace(/\s+/g, " "));
  const m = new Map<string, number>();
  for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
    const idx = norm.findIndex((h) => aliases.includes(h));
    if (idx >= 0) m.set(key, idx);
  }
  return m;
}

const tidy = (v: string | undefined | null): string | null => {
  const t = (v ?? "").replace(/\s+/g, " ").trim();
  return t ? t : null;
};

const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[a-z]{2,}$/i;
export function normalizeEmail(v: string | null | undefined): { email: string | null; invalid: boolean } {
  const t = tidy(v)?.toLowerCase().replace(/^mailto:/, "") ?? null;
  if (!t) return { email: null, invalid: false };
  // Several addresses in one cell: keep the first.
  const first = t.split(/[;,\s]+/)[0];
  return EMAIL_RE.test(first) ? { email: first, invalid: false } : { email: null, invalid: true };
}

/** US numbers become (AAA) BBB-CCCC; extensions are kept; anything else is left as written. */
export function normalizePhone(v: string | null | undefined): string | null {
  const t = tidy(v);
  if (!t) return null;
  const [main, ...rest] = t.split(/\s*(?:ext\.?|x)\s*/i);
  let d = main.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
  if (d.length !== 10 || main.trim().startsWith("+") && !main.trim().startsWith("+1")) return t;
  const ext = rest.join("").replace(/\D/g, "");
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}${ext ? ` ext. ${ext}` : ""}`;
}

const PLACEHOLDERS = new Set(["na", "n/a", "none", "null", "-", "unknown"]);

/**
 * Placeholders ("na", "n/a") become empty. All lower case becomes title case.
 * All caps is left alone: it is usually an acronym ("LWO LLC") rather than shouting.
 */
export function normalizeName(v: string | null | undefined): string | null {
  const t = tidy(v);
  if (!t || PLACEHOLDERS.has(t.toLowerCase())) return null;
  if (t !== t.toLowerCase()) return t;
  return t.replace(/\b([a-z])/g, (c) => c.toUpperCase());
}

const num = (v: string | null | undefined): number | null => {
  const t = (v ?? "").replace(/[$,\s]/g, "");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

const list = (v: string | null | undefined): string[] =>
  (v ?? "").split(/[;|]/).map((x) => x.trim()).filter(Boolean);

/**
 * Public labels (SBA fund styles and strategies, common terms) onto the
 * platform option slugs (vocabulary_options). Unknown labels map to nothing:
 * a verifier fills the field rather than the import guessing.
 */
export function mapInvestorTypes(style: string | null, type: string | null): string[] {
  const s = `${style ?? ""} ${type ?? ""}`.toLowerCase();
  const out = new Set<string>();
  if (/venture/.test(s)) out.add("venture-capital");
  if (/private equity|growth equity|buyout|hybrid/.test(s)) out.add("private-equity");
  if (/private credit|lend|debt|mezzanine/.test(s)) out.add("lender");
  if (/family office/.test(s)) out.add("family-office");
  if (/angel/.test(s)) out.add("angel-investor");
  if (/hedge/.test(s)) out.add("hedge-fund");
  if (/fund of funds/.test(s)) out.add("other");
  return [...out];
}

export function mapFundingStages(strategy: string | null, style: string | null): string[] {
  const s = `${strategy ?? ""} ${style ?? ""}`.toLowerCase();
  const out = new Set<string>();
  if (/pre-?seed/.test(s)) out.add("pre-seed");
  if (/early|seed/.test(s)) out.add("seed");
  if (/balanced venture|\bventure\b/.test(s) && !/early/.test(s)) { out.add("seed"); out.add("series-a"); }
  if (/series a/.test(s)) out.add("series-a");
  if (/series b/.test(s)) out.add("series-b");
  if (/growth|expansion/.test(s)) out.add("growth");
  return [...out];
}

export function mapCapitalTypes(style: string | null, strategy: string | null): string[] {
  const s = `${style ?? ""} ${strategy ?? ""}`.toLowerCase();
  const out = new Set<string>();
  if (/venture|equity|buyout|hybrid/.test(s)) out.add("equity-capital");
  if (/credit|lend|debt|mezzanine|hybrid/.test(s)) out.add("debt-capital");
  return [...out];
}

function yesNo(v: string | null): boolean | null {
  const t = (v ?? "").trim().toLowerCase();
  if (["yes", "y", "true", "1"].includes(t)) return true;
  if (["no", "n", "false", "0"].includes(t)) return false;
  return null;
}

/** Parse, map, normalize and dedupe one CSV file. */
export function cleanCsv(text: string): CleanResult {
  const cells = parseCsv(text);
  if (cells.length < 2) return { rows: [], rowCount: 0, merged: 0, invalidEmails: 0, skipped: 0 };
  const h = mapHeaders(cells[0]);
  const get = (r: string[], k: string): string | null => {
    const i = h.get(k);
    return i === undefined ? null : tidy(r[i]);
  };
  let invalidEmails = 0;
  let skipped = 0;
  let merged = 0;
  const byKey = new Map<string, CleanRow>();
  for (const r of cells.slice(1)) {
    const firm = normalizeName(get(r, "firm")) ?? normalizeName(get(r, "fund_name"));
    if (!firm) { skipped++; continue; }
    const { email, invalid } = normalizeEmail(get(r, "email"));
    if (invalid) invalidEmails++;
    const style = get(r, "style");
    const type = get(r, "type");
    const strategy = get(r, "strategy");
    const typed = list(get(r, "investor_types"));
    const staged = list(get(r, "funding_stages"));
    const capital = list(get(r, "capital_types"));
    const row: CleanRow = {
      firm,
      contact_name: normalizeName(get(r, "contact_name")),
      title: get(r, "title"),
      email,
      phone: normalizePhone(get(r, "phone")),
      website: get(r, "website"),
      city: normalizeName(get(r, "city")),
      state: get(r, "state")?.toUpperCase() ?? null,
      investor_types: typed.length ? typed : mapInvestorTypes(style, type),
      funding_stages: staged.length ? staged : mapFundingStages(strategy, style),
      capital_types: capital.length ? capital : mapCapitalTypes(style, strategy),
      industries: list(get(r, "industries")),
      fund_name: get(r, "fund_name"),
      fund_size: num(get(r, "fund_size")),
      avg_investment: num(get(r, "avg_investment")),
      strategy,
      investing_now: yesNo(get(r, "investing_now")),
    };
    const key = email ?? `${firm.toLowerCase()}|${(row.contact_name ?? "").toLowerCase()}`;
    const prev = byKey.get(key);
    if (prev) {
      merged++;
      mergeInto(prev, row);
      continue;
    }
    byKey.set(key, row);
  }
  return { rows: [...byKey.values()], rowCount: cells.length - 1, merged, invalidEmails, skipped };
}

/** Keep what the first row has, fill its gaps, union the lists. */
function mergeInto(prev: CleanRow, row: CleanRow): void {
  const p = prev as Record<string, unknown>;
  for (const [k, nv] of Object.entries(row)) {
    const pv = p[k];
    if (Array.isArray(pv) && Array.isArray(nv)) p[k] = [...new Set([...pv, ...nv])];
    else if ((pv === null || pv === undefined) && nv !== null) p[k] = nv;
  }
  if (row.investing_now === true) prev.investing_now = true;
}
