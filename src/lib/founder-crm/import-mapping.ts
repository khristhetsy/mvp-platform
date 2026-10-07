// Founder contact import: read a dropped file's cells, match its columns to
// founder contact fields, and build the rows the import API takes.
//
// Pure (no I/O), so the drop zone can preview counts before anything is saved.
// Handles LinkedIn's Connections.csv, which starts with a few "Notes:" lines
// above the real header row.

import type { CsvImportRow } from "@/lib/founder-crm/csv-import";

export type ImportTarget =
  | "skip"
  | "full_name"
  | "first_name"
  | "last_name"
  | "email"
  | "firm_name"
  | "position"
  | "investor_type"
  | "sector"
  | "stage"
  | "check_size"
  | "geography"
  | "website"
  | "linkedin_url"
  | "notes";

export const IMPORT_TARGETS: Array<{ key: ImportTarget; label: string }> = [
  { key: "full_name", label: "Full name" },
  { key: "first_name", label: "First name" },
  { key: "last_name", label: "Last name" },
  { key: "email", label: "Email" },
  { key: "firm_name", label: "Firm" },
  { key: "position", label: "Title" },
  { key: "investor_type", label: "Investor type" },
  { key: "sector", label: "Industry or sector" },
  { key: "stage", label: "Stage" },
  { key: "check_size", label: "Check size" },
  { key: "geography", label: "Geography" },
  { key: "website", label: "Website" },
  { key: "linkedin_url", label: "LinkedIn URL" },
  { key: "notes", label: "Notes" },
  { key: "skip", label: "Skip this column" },
];

export const TARGET_LABEL: Record<ImportTarget, string> = Object.fromEntries(
  IMPORT_TARGETS.map((t) => [t.key, t.label]),
) as Record<ImportTarget, string>;

/** Column header aliases, normalized (lowercase, letters and digits only). */
const ALIASES: Record<Exclude<ImportTarget, "skip">, string[]> = {
  full_name: ["name", "fullname", "investorname", "contactname", "contact"],
  first_name: ["firstname", "first", "givenname"],
  last_name: ["lastname", "last", "surname", "familyname"],
  email: ["email", "emailaddress", "mail", "workemail", "emailaddresses"],
  firm_name: ["firm", "firmname", "company", "companyname", "organization", "organisation", "fund", "fundname"],
  position: ["position", "title", "jobtitle", "role"],
  investor_type: ["investortype", "type"],
  sector: ["sector", "sectors", "industry", "industries", "focus"],
  stage: ["stage", "stages"],
  check_size: ["checksize", "ticket", "ticketsize", "cheque", "chequesize"],
  geography: ["geography", "location", "region", "country", "city"],
  website: ["website", "web", "site", "homepage"],
  linkedin_url: ["linkedin", "linkedinurl", "linkedinprofile", "profileurl", "url"],
  notes: ["notes", "note", "comments", "description"],
};

export function normHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function autoTarget(header: string): ImportTarget {
  const n = normHeader(header);
  if (!n) return "skip";
  for (const [target, names] of Object.entries(ALIASES) as Array<[ImportTarget, string[]]>) {
    if (names.includes(n)) return target;
  }
  return "skip";
}

/** Match every column; a field already taken by an earlier column is not reused. */
export function autoMap(columns: string[]): ImportTarget[] {
  const used = new Set<ImportTarget>();
  return columns.map((c) => {
    const t = autoTarget(c);
    if (t === "skip" || used.has(t)) return "skip";
    used.add(t);
    return t;
  });
}

/**
 * Split cells into header + rows. LinkedIn exports put "Notes:" lines above the
 * header; the header is the first row with at least two non empty cells that
 * includes a recognised column.
 */
export function findHeader(cells: string[][]): { columns: string[]; rows: string[][]; linkedin: boolean } {
  const clean = cells.filter((r) => r.some((c) => c.trim()));
  let at = 0;
  for (let i = 0; i < Math.min(clean.length, 10); i++) {
    const filled = clean[i].filter((c) => c.trim()).length;
    if (filled >= 2 && clean[i].some((c) => autoTarget(c) !== "skip")) {
      at = i;
      break;
    }
  }
  const head = clean[at] ?? [];
  const columns = head.map((h, i) => h.trim() || `Column ${i + 1}`);
  const norm = columns.map(normHeader);
  const linkedin = norm.includes("firstname") && norm.includes("lastname") && norm.includes("connectedon");
  return { columns, rows: clean.slice(at + 1), linkedin };
}

export type MappedImport = {
  /** Rows ready to import (have a name; email optional). */
  rows: CsvImportRow[];
  /** Rows with no name at all; they can't be imported. */
  missingName: number;
  /** Ready rows without an email (they import, but can't be emailed). */
  noEmail: number;
  /** Rows dropped because their email is already a contact or repeats in the file. */
  duplicates: number;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function applyImportMapping(
  rows: string[][],
  mapping: ImportTarget[],
  existingEmails: Iterable<string> = [],
): MappedImport {
  const known = new Set([...existingEmails].map((e) => e.trim().toLowerCase()).filter(Boolean));
  const seen = new Set<string>();
  const out: CsvImportRow[] = [];
  let missingName = 0;
  let noEmail = 0;
  let duplicates = 0;

  for (const r of rows) {
    const v: Partial<Record<ImportTarget, string>> = {};
    mapping.forEach((t, i) => {
      if (t === "skip") return;
      const cell = (r[i] ?? "").trim();
      if (cell && !v[t]) v[t] = cell;
    });

    const name = v.full_name || [v.first_name, v.last_name].filter(Boolean).join(" ").trim();
    if (!name) {
      missingName += 1;
      continue;
    }

    const rawEmail = (v.email ?? "").toLowerCase();
    const email = EMAIL_RE.test(rawEmail) ? rawEmail : "";
    if (email) {
      if (known.has(email) || seen.has(email)) {
        duplicates += 1;
        continue;
      }
      seen.add(email);
    } else {
      noEmail += 1;
    }

    const notes = [v.position ? `Title: ${v.position}` : "", v.notes ?? ""].filter(Boolean).join("\n");
    const row: CsvImportRow = { investor_name: name };
    if (email) row.email = email;
    if (v.firm_name) row.firm_name = v.firm_name;
    if (v.investor_type) row.investor_type = v.investor_type;
    if (v.sector) row.sector = v.sector;
    if (v.stage) row.stage = v.stage;
    if (v.check_size) row.check_size = v.check_size;
    if (v.geography) row.geography = v.geography;
    if (v.website) row.website = v.website;
    if (v.linkedin_url) row.linkedin_url = v.linkedin_url;
    if (notes) row.notes = notes;
    out.push(row);
  }

  return { rows: out, missingName, noEmail, duplicates };
}

/** The template founders can download and fill in. */
export const TEMPLATE_CSV =
  "full_name,email,firm,title,investor_type,sector,stage,check_size,geography,linkedin_url,notes\n" +
  "Ada Lovelace,ada@analyticalventures.com,Analytical Ventures,Partner,VC,Fintech,Seed,250k-1m,US,https://www.linkedin.com/in/ada,Met at demo day\n";
