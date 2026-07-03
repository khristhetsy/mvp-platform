// Bulk consent import for warm/opted-in leads. Resolves each identifier
// (Odoo contact id or email) to a mirrored crm_contact, then writes a voice
// consent_records row carrying the opt-in source + evidence. Skips contacts
// that already have live voice consent. Service-role only; admin-gated in the
// API. The caller attests (per row batch) that these contacts opted in.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { ConsentType } from "@/lib/voice/types";

function raw(c: SupabaseClient<Database>): SupabaseClient {
  return c as unknown as SupabaseClient;
}

export interface ImportInput {
  identifiers: string[]; // Odoo external_id or email, one per line
  source: string;
  consentType: ConsentType;
  timezone: string;      // IANA, e.g. America/New_York
  jurisdiction?: string; // e.g. US, US-CA
  evidenceUrl?: string | null;
}

export interface ImportResult {
  inserted: number;
  skippedExisting: number;
  notFound: string[];
}

export async function importConsent(input: ImportInput): Promise<ImportResult> {
  const supabase = raw(createServiceRoleClient());
  const ids = [...new Set(input.identifiers.map((s) => s.trim()).filter(Boolean))];
  if (ids.length === 0) return { inserted: 0, skippedExisting: 0, notFound: [] };

  const emails = ids.filter((s) => s.includes("@")).map((s) => s.toLowerCase());
  const externalIds = ids.filter((s) => !s.includes("@"));

  // Resolve to crm_contacts rows (Odoo source).
  const byExternal = new Map<string, { external_id: string; email: string | null; raw: Record<string, unknown> | null }>();
  const byEmail = new Map<string, { external_id: string; email: string | null; raw: Record<string, unknown> | null }>();

  if (externalIds.length) {
    const { data } = await supabase.from("crm_contacts").select("external_id, email, raw").eq("source", "odoo").in("external_id", externalIds);
    for (const r of (data ?? []) as { external_id: string; email: string | null; raw: Record<string, unknown> | null }[]) byExternal.set(r.external_id, r);
  }
  if (emails.length) {
    const { data } = await supabase.from("crm_contacts").select("external_id, email, raw").eq("source", "odoo").in("email", emails);
    for (const r of (data ?? []) as { external_id: string; email: string | null; raw: Record<string, unknown> | null }[]) if (r.email) byEmail.set(r.email.toLowerCase(), r);
  }

  const resolved: { external_id: string; phone: string | null }[] = [];
  const notFound: string[] = [];
  for (const id of ids) {
    const rec = id.includes("@") ? byEmail.get(id.toLowerCase()) : byExternal.get(id);
    if (!rec) { notFound.push(id); continue; }
    const rawObj = rec.raw ?? {};
    const phone = (rawObj.phone as string) || (rawObj.mobile as string) || null;
    resolved.push({ external_id: rec.external_id, phone });
  }
  if (resolved.length === 0) return { inserted: 0, skippedExisting: 0, notFound };

  // Skip contacts that already have a live voice consent.
  const targetIds = resolved.map((r) => r.external_id);
  const { data: existing } = await supabase
    .from("consent_records")
    .select("contact_id")
    .eq("channel", "voice")
    .is("revoked_at", null)
    .in("contact_id", targetIds);
  const already = new Set(((existing ?? []) as { contact_id: string }[]).map((r) => r.contact_id));

  const toInsert = resolved.filter((r) => !already.has(r.external_id));
  const nowIso = new Date().toISOString();
  const rows = toInsert.map((r) => ({
    contact_id: r.external_id,
    phone: r.phone,
    channel: "voice",
    consent_type: input.consentType,
    source: input.source,
    jurisdiction: input.jurisdiction ?? "US",
    call_timezone: input.timezone,
    captured_at: nowIso,
    evidence_url: input.evidenceUrl ?? null,
  }));

  if (rows.length) {
    const { error } = await supabase.from("consent_records").insert(rows);
    if (error) throw new Error(error.message);
  }

  return { inserted: rows.length, skippedExisting: already.size, notFound };
}
