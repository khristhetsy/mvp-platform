// Segment-based consent + the batch dialer. Lets an admin add a whole CRM
// segment to the call list (records consent), then dial the eligible pool in
// waves through Vapi. Every dial still passes pre_dial_gate. Service-role only.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { ConsentType } from "@/lib/voice/types";
import { preDialGate } from "@/lib/voice/gate";
import { placeVapiCall } from "@/lib/voice/vapi";

function raw(c: SupabaseClient<Database>): SupabaseClient {
  return c as unknown as SupabaseClient;
}

export interface CallListSegment {
  kind: "module" | "status";
  value: string;
  label: string;
  count: number;
}

const MODULE_LABEL: Record<string, string> = { founder: "Founders", investor: "Investors", unknown: "Unclassified" };

export async function loadCallListSegments(): Promise<CallListSegment[]> {
  const supabase = raw(createServiceRoleClient());
  const out: CallListSegment[] = [];

  for (const m of ["investor", "founder", "unknown"]) {
    const { count } = await supabase.from("crm_contacts").select("external_id", { count: "exact", head: true }).eq("source", "odoo").eq("module", m);
    if ((count ?? 0) > 0) out.push({ kind: "module", value: m, label: MODULE_LABEL[m] ?? m, count: count ?? 0 });
  }

  // Internal CRM statuses (from annotations) become segments too — e.g. Qualified/Engaged as "hot".
  const { data: ann } = await supabase.from("crm_contact_annotations").select("status").not("status", "is", null);
  const byStatus = new Map<string, number>();
  for (const r of (ann ?? []) as { status: string | null }[]) {
    if (r.status) byStatus.set(r.status, (byStatus.get(r.status) ?? 0) + 1);
  }
  for (const [status, count] of byStatus) out.push({ kind: "status", value: status, label: `Status: ${status}`, count });

  return out;
}

/** Contact external_ids in a segment. */
async function segmentContactIds(kind: string, value: string): Promise<string[]> {
  const supabase = raw(createServiceRoleClient());
  if (kind === "status") {
    const { data } = await supabase.from("crm_contact_annotations").select("external_id").eq("source", "odoo").eq("status", value);
    return ((data ?? []) as { external_id: string }[]).map((r) => r.external_id);
  }
  const { data } = await supabase.from("crm_contacts").select("external_id").eq("source", "odoo").eq("module", value);
  return ((data ?? []) as { external_id: string }[]).map((r) => r.external_id);
}

export interface SegmentImportInput {
  kind: string;
  value: string;
  source: string;
  consentType: ConsentType;
  timezone: string;
  jurisdiction?: string;
  evidenceUrl?: string | null;
}

/** Record voice consent for every contact in a segment. Chunked; skips already-consented. */
export async function importSegmentConsent(input: SegmentImportInput): Promise<{ inserted: number; skippedExisting: number; total: number }> {
  const supabase = raw(createServiceRoleClient());
  const ids = await segmentContactIds(input.kind, input.value);
  if (ids.length === 0) return { inserted: 0, skippedExisting: 0, total: 0 };

  // Existing live voice consent (small set) → skip.
  const { data: existing } = await supabase.from("consent_records").select("contact_id").eq("channel", "voice").is("revoked_at", null);
  const already = new Set(((existing ?? []) as { contact_id: string }[]).map((r) => r.contact_id));
  const toInsert = ids.filter((id) => !already.has(id));

  const nowIso = new Date().toISOString();
  let inserted = 0;
  for (let i = 0; i < toInsert.length; i += 500) {
    const rows = toInsert.slice(i, i + 500).map((id) => ({
      contact_id: id,
      channel: "voice",
      consent_type: input.consentType,
      source: input.source,
      jurisdiction: input.jurisdiction ?? "US",
      call_timezone: input.timezone,
      captured_at: nowIso,
      evidence_url: input.evidenceUrl ?? null,
    }));
    const { error } = await supabase.from("consent_records").insert(rows);
    if (error) throw new Error(error.message);
    inserted += rows.length;
  }
  return { inserted, skippedExisting: ids.length - toInsert.length, total: ids.length };
}

// ── Batch dialer ─────────────────────────────────────────────────────────────

export async function dialableCount(): Promise<number> {
  const supabase = raw(createServiceRoleClient());
  const { count } = await supabase.from("v_call_queue").select("contact_id", { count: "exact", head: true });
  return count ?? 0;
}

/** Dial one wave of eligible contacts. `exclude` = contact_ids already dialed this run. */
export async function dialBatch(
  max: number,
  exclude: string[],
): Promise<{ dialed: { contactId: string; name: string | null; ok: boolean; error?: string }[]; remaining: number }> {
  const supabase = raw(createServiceRoleClient());
  const excludeSet = new Set(exclude);
  const { data } = await supabase
    .from("v_call_queue")
    .select("contact_id, name, phone")
    .limit(max + exclude.length + 5);
  const rows = ((data ?? []) as { contact_id: string; name: string | null; phone: string | null }[])
    .filter((r) => !excludeSet.has(r.contact_id))
    .slice(0, max);

  const dialed: { contactId: string; name: string | null; ok: boolean; error?: string }[] = [];
  for (const r of rows) {
    const gate = await preDialGate(r.contact_id);
    if (!gate.eligible || !gate.phone) {
      dialed.push({ contactId: r.contact_id, name: r.name, ok: false, error: gate.reason });
      continue;
    }
    try {
      await placeVapiCall(gate.phone);
      dialed.push({ contactId: r.contact_id, name: r.name, ok: true });
    } catch (err) {
      dialed.push({ contactId: r.contact_id, name: r.name, ok: false, error: err instanceof Error ? err.message : "dial failed" });
    }
  }
  const remaining = await dialableCount();
  return { dialed, remaining };
}
