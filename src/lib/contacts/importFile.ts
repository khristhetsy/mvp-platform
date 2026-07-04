// Prospect Pipeline — import parsed contacts into crm_contacts (source of record),
// deduped on lower(email), then bridge into marketing_contacts so the Hub shows
// them immediately (Step 1). crm_contacts is canonical; marketing_contacts mirrors.

import { serviceRoleClientUntyped } from "@/lib/supabase/admin";
import { deriveDomain, isValidEmail, splitName, type ImportResult, type ImportSource, type ParsedContact } from "./types";

interface NormalizedContact {
  email: string;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  company_domain: string | null;
  website: string | null;
  phone: string | null;
  side: "founder" | "investor" | null;
  note: string | null;
}

function normalize(row: ParsedContact): NormalizedContact | null {
  const email = (row.email ?? "").trim().toLowerCase();
  if (!isValidEmail(email)) return null;
  const nameParts = row.first_name || row.last_name
    ? { first: row.first_name ?? null, last: row.last_name ?? null }
    : splitName(row.name);
  const name = row.name?.trim() || [nameParts.first, nameParts.last].filter(Boolean).join(" ") || null;
  return {
    email,
    name,
    first_name: nameParts.first,
    last_name: nameParts.last,
    company: row.company?.trim() || null,
    company_domain: deriveDomain(row.website, email),
    website: row.website?.trim() || null,
    phone: row.phone?.trim() || null,
    side: row.side ?? null,
    note: row.note?.trim() || null,
  };
}

/**
 * Import a batch of parsed contacts. Dedupes on lower(email) both within the
 * batch and against the existing mirror. Existing rows get non-null fields
 * merged; new rows are inserted with the given source. Returns counts.
 */
export async function importParsedRows(rows: ParsedContact[], source: ImportSource): Promise<ImportResult> {
  const db = serviceRoleClientUntyped();

  // De-dupe within batch (keep first occurrence of each email).
  const seen = new Set<string>();
  const contacts: NormalizedContact[] = [];
  let skipped = 0;
  for (const raw of rows) {
    const c = normalize(raw);
    if (!c) { skipped++; continue; }
    if (seen.has(c.email)) { skipped++; continue; }
    seen.add(c.email);
    contacts.push(c);
  }
  if (contacts.length === 0) return { inserted: 0, merged: 0, skipped, total: rows.length };

  const emails = contacts.map((c) => c.email);

  // Find existing rows in the mirror by email (case-insensitive).
  const { data: existingRows } = await db
    .from("crm_contacts")
    .select("id, email, name, company, company_domain, phone, side, module")
    .in("email", emails);
  const existingByEmail = new Map<string, Record<string, unknown>>();
  for (const r of (existingRows ?? []) as Array<Record<string, unknown>>) {
    const e = String(r.email ?? "").toLowerCase();
    if (e && !existingByEmail.has(e)) existingByEmail.set(e, r);
  }

  let inserted = 0;
  let merged = 0;
  const inserts: Array<Record<string, unknown>> = [];

  for (const c of contacts) {
    const existing = existingByEmail.get(c.email);
    if (existing) {
      // Merge: only fill fields that are currently empty on the existing row.
      const patch: Record<string, unknown> = {};
      if (!existing.name && c.name) patch.name = c.name;
      if (!existing.company && c.company) patch.company = c.company;
      if (!existing.company_domain && c.company_domain) patch.company_domain = c.company_domain;
      if (!existing.phone && c.phone) { patch.phone = c.phone; patch.phone_source = "given"; }
      if (!existing.side && c.side) { patch.side = c.side; patch.side_confidence = 100; }
      if (Object.keys(patch).length > 0) {
        patch.updated_at = new Date().toISOString();
        await db.from("crm_contacts").update(patch).eq("id", existing.id as string);
      }
      merged++;
    } else {
      inserts.push({
        source,
        external_id: c.email, // app-level email dedupe; unique with (source, external_id)
        module: c.side ?? "unknown",
        side: c.side,
        side_confidence: c.side ? 100 : null,
        name: c.name,
        email: c.email,
        company: c.company,
        company_domain: c.company_domain,
        phone: c.phone,
        phone_source: c.phone ? "given" : null,
        email_status: "unverified",
        email_source: "given",
        enrichment_status: c.website || c.company_domain ? "pending" : "no_website",
        signals: {},
        tags: [],
        raw: { note: c.note ?? null, website: c.website ?? null, imported_via: source },
      });
      inserted++;
    }
  }

  if (inserts.length > 0) {
    const { error } = await db.from("crm_contacts").upsert(inserts, { onConflict: "source,external_id" });
    if (error) throw new Error(error.message);
  }

  // Bridge into marketing_contacts so the Hub reflects the new/updated rows now.
  const bridge = contacts.map((c) => ({
    email: c.email,
    first_name: c.first_name,
    last_name: c.last_name,
    company: c.company,
    source: source === "manual" ? "Manual add" : `File import (${source})`,
  }));
  if (bridge.length > 0) {
    await db.from("marketing_contacts").upsert(bridge, { onConflict: "email" });
  }

  return { inserted, merged, skipped, total: rows.length };
}
