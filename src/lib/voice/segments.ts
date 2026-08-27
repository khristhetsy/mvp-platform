// Segment-based consent + the batch dialer. Lets an admin add a whole CRM
// segment to the call list (records consent), then dial the eligible pool in
// waves through Vapi. Every dial still passes pre_dial_gate. Service-role only.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { ConsentType } from "@/lib/voice/types";
import { preDialGate } from "@/lib/voice/gate";
import { placeVapiCall } from "@/lib/voice/vapi";
import { pickVariant } from "@/lib/voice/campaigns";
import { dialRestriction } from "@/lib/voice/audience";
import type { AudienceConfig } from "@/lib/voice/types";

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
export async function segmentContactIds(kind: string, value: string): Promise<string[]> {
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

/** Dial one wave of eligible contacts. `exclude` = contact_ids already dialed
 *  this run. When `campaignId` is given, each dial draws an A/B variant (weighted
 *  by traffic_weight) and carries its id + opener onto the call. */
export async function dialBatch(
  max: number,
  exclude: string[],
  campaignId?: string | null,
): Promise<{ dialed: { contactId: string; name: string | null; ok: boolean; variantId?: string | null; error?: string }[]; remaining: number }> {
  const supabase = raw(createServiceRoleClient());
  const excludeSet = new Set(exclude);

  // Scope the queue to the campaign's audience (list / segment / contacts). Null
  // = the whole eligible pool. An empty scope means nobody is in this campaign.
  let restrictIds: string[] | null = null;
  if (campaignId) {
    const { data: camp } = await supabase.from("voice_campaigns").select("audience_config").eq("id", campaignId).maybeSingle();
    restrictIds = dialRestriction((camp as { audience_config?: AudienceConfig | null } | null)?.audience_config ?? null);
    if (restrictIds && restrictIds.length === 0) return { dialed: [], remaining: 0 };
  }

  // Pull candidates from the queue. A restricted audience can be far larger than
  // Postgres/PostgREST can take in one `.in(...)`, so page the restrict set in
  // chunks of 1000 and stop once we have enough eligible candidates — this covers
  // the WHOLE audience across waves rather than only its first 1000 contacts.
  const need = max + exclude.length + 5;
  const candidates: { contact_id: string; name: string | null; phone: string | null }[] = [];
  if (restrictIds) {
    for (let i = 0; i < restrictIds.length && candidates.length < need; i += 1000) {
      const chunk = restrictIds.slice(i, i + 1000);
      const { data } = await supabase
        .from("v_call_queue").select("contact_id, name, phone")
        .in("contact_id", chunk).limit(need - candidates.length);
      candidates.push(...((data ?? []) as { contact_id: string; name: string | null; phone: string | null }[]));
    }
  } else {
    const { data } = await supabase.from("v_call_queue").select("contact_id, name, phone").limit(need);
    candidates.push(...((data ?? []) as { contact_id: string; name: string | null; phone: string | null }[]));
  }
  const rows = candidates.filter((r) => !excludeSet.has(r.contact_id)).slice(0, max);

  const dialed: { contactId: string; name: string | null; ok: boolean; variantId?: string | null; error?: string }[] = [];
  for (const r of rows) {
    const gate = await preDialGate(r.contact_id);
    if (!gate.eligible || !gate.phone) {
      dialed.push({ contactId: r.contact_id, name: r.name, ok: false, error: gate.reason });
      continue;
    }
    // Draw the A/B variant per contact so weights hold across the wave.
    const variant = campaignId ? await pickVariant(campaignId) : null;
    try {
      await placeVapiCall(gate.phone, {
        metadata: { contactId: r.contact_id, campaignId: campaignId ?? null, variantId: variant?.id ?? null },
        opener: variant?.openerScript ?? null,
      });
      dialed.push({ contactId: r.contact_id, name: r.name, ok: true, variantId: variant?.id ?? null });
    } catch (err) {
      dialed.push({ contactId: r.contact_id, name: r.name, ok: false, error: err instanceof Error ? err.message : "dial failed" });
    }
  }
  const remaining = await dialableCount();
  return { dialed, remaining };
}
