// Read-only data layer for the Consent Ledger (Govern surface). Service-role
// only. Everything is empty until consent rows are captured — the honest,
// safe, consent-closed default state.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { ConsentRecord, DncEntry, ConsentLedgerSummary } from "@/lib/voice/types";

function raw(c: SupabaseClient<Database>): SupabaseClient {
  return c as unknown as SupabaseClient;
}

export async function loadConsentLedger(): Promise<{
  summary: ConsentLedgerSummary;
  consents: ConsentRecord[];
  dnc: DncEntry[];
}> {
  const supabase = raw(createServiceRoleClient());
  const nowIso = new Date().toISOString();
  const headCount = (p: PromiseLike<{ count: number | null }>) => p.then((r) => r.count ?? 0);

  const [consentRecords, revoked, onDnc, dialableNow, liveConsents] = await Promise.all([
    headCount(supabase.from("consent_records").select("id", { count: "exact", head: true })),
    headCount(supabase.from("consent_records").select("id", { count: "exact", head: true }).not("revoked_at", "is", null)),
    headCount(supabase.from("dnc_list").select("id", { count: "exact", head: true })),
    headCount(supabase.from("v_call_queue").select("contact_id", { count: "exact", head: true })),
    headCount(supabase.from("consent_records").select("id", { count: "exact", head: true }).is("revoked_at", null).or(`expires_at.is.null,expires_at.gt.${nowIso}`)),
  ]);

  const { data: consentRows } = await supabase
    .from("consent_records")
    .select("*")
    .order("captured_at", { ascending: false })
    .limit(100);

  const { data: dncRows } = await supabase
    .from("dnc_list")
    .select("*")
    .order("added_at", { ascending: false })
    .limit(100);

  const consents: ConsentRecord[] = ((consentRows ?? []) as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    contactId: String(r.contact_id),
    phone: (r.phone as string) ?? null,
    channel: r.channel as ConsentRecord["channel"],
    consentType: r.consent_type as ConsentRecord["consentType"],
    source: (r.source as string) ?? null,
    jurisdiction: (r.jurisdiction as string) ?? null,
    callTimezone: (r.call_timezone as string) ?? null,
    capturedAt: String(r.captured_at),
    expiresAt: (r.expires_at as string) ?? null,
    evidenceUrl: (r.evidence_url as string) ?? null,
    revokedAt: (r.revoked_at as string) ?? null,
  }));

  const dnc: DncEntry[] = ((dncRows ?? []) as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    number: String(r.number),
    scope: r.scope as DncEntry["scope"],
    reason: (r.reason as string) ?? null,
    addedAt: String(r.added_at),
  }));

  return {
    summary: { consentRecords, liveConsents: liveConsents ?? 0, revoked, onDnc, dialableNow },
    consents,
    dnc,
  };
}
