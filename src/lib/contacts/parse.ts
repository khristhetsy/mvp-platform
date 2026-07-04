// Prospect Pipeline — file parsers (CSV, XLSX, vCard) → ParsedContact[] (Step 1).

import ExcelJS from "exceljs";
import type { ContactSide, ParsedContact } from "./types";

// Header aliases → canonical field. Lowercased, trimmed comparison.
const HEADER_ALIASES: Record<keyof ParsedContact, string[]> = {
  email: ["email", "e-mail", "email address", "work email", "mail"],
  name: ["name", "full name", "contact", "contact name"],
  first_name: ["first name", "first", "firstname", "given name", "fname"],
  last_name: ["last name", "last", "lastname", "surname", "family name", "lname"],
  company: ["company", "organization", "organisation", "org", "account", "employer"],
  website: ["website", "url", "domain", "site", "web"],
  phone: ["phone", "mobile", "tel", "telephone", "cell", "phone number"],
  side: ["side", "type", "role", "category", "membership"],
  note: ["note", "notes", "comment", "comments"],
};

function canonicalField(header: string): keyof ParsedContact | null {
  const h = header.trim().toLowerCase();
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    if (aliases.includes(h)) return field as keyof ParsedContact;
  }
  return null;
}

function normalizeSide(raw: string | undefined): ContactSide | null {
  const v = (raw ?? "").trim().toLowerCase();
  if (["founder", "entrepreneur", "startup", "company"].includes(v)) return "founder";
  if (["investor", "vc", "fund", "angel", "lp"].includes(v)) return "investor";
  return null;
}

function rowToContact(headerMap: (keyof ParsedContact | null)[], cells: string[]): ParsedContact {
  const c: ParsedContact = {};
  headerMap.forEach((field, i) => {
    if (!field) return;
    const val = (cells[i] ?? "").trim();
    if (!val) return;
    if (field === "side") c.side = normalizeSide(val);
    else (c as Record<string, unknown>)[field] = val;
  });
  return c;
}

/** RFC-4180-ish CSV line splitter that respects quoted fields. */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else cur += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

export function parseCsv(text: string): ParsedContact[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n").filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const headerMap = splitCsvLine(lines[0]).map(canonicalField);
  return lines.slice(1).map((line) => rowToContact(headerMap, splitCsvLine(line)));
}

export async function parseXlsx(buffer: ArrayBuffer): Promise<ParsedContact[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  if (!ws) return [];
  const rows: string[][] = [];
  ws.eachRow((row) => {
    const cells: string[] = [];
    // exceljs is 1-indexed; values[0] is null
    const values = row.values as unknown[];
    for (let i = 1; i < values.length; i++) {
      const v = values[i];
      cells.push(v == null ? "" : typeof v === "object" && "text" in (v as object) ? String((v as { text: unknown }).text) : String(v));
    }
    rows.push(cells);
  });
  if (rows.length < 2) return [];
  const headerMap = rows[0].map(canonicalField);
  return rows.slice(1).map((cells) => rowToContact(headerMap, cells));
}

/** Minimal vCard 3.0/4.0 parser: FN/N, EMAIL, TEL, ORG, URL, NOTE. */
export function parseVcard(text: string): ParsedContact[] {
  const cards = text.replace(/\r\n/g, "\n").split(/BEGIN:VCARD/i).slice(1);
  const out: ParsedContact[] = [];
  for (const card of cards) {
    const c: ParsedContact = {};
    for (const rawLine of card.split("\n")) {
      const line = rawLine.trim();
      if (!line || /^END:VCARD/i.test(line)) continue;
      const idx = line.indexOf(":");
      if (idx === -1) continue;
      const key = line.slice(0, idx).split(";")[0].toUpperCase();
      const val = line.slice(idx + 1).trim();
      if (!val) continue;
      if (key === "FN") c.name = val;
      else if (key === "N" && !c.name) c.name = val.split(";").filter(Boolean).reverse().join(" ").trim();
      else if (key === "EMAIL") c.email = c.email ?? val;
      else if (key === "TEL") c.phone = c.phone ?? val;
      else if (key === "ORG") c.company = c.company ?? val.split(";")[0];
      else if (key === "URL") c.website = c.website ?? val;
      else if (key === "NOTE") c.note = val;
    }
    if (c.email || c.name) out.push(c);
  }
  return out;
}
