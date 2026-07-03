// The single chokepoint. Nothing dials without an `eligible` result from here.
// Defense-in-depth: this wraps the authoritative pre_dial_gate() SQL RPC, and
// adds the dormant feature-flag check on top. Service-role only (PII + RLS).

import { createServiceRoleClient } from "@/lib/supabase/admin";
import type { GateResult, GateBlockReason } from "@/lib/voice/types";

/**
 * Master kill-switch. Outbound is OFF unless VOICE_OUTBOUND_ENABLED is explicitly
 * truthy AND the (human-approved) migration + legal sign-off are in place. While
 * off, the gate blocks every dial — the whole subsystem is dormant.
 */
export function voiceOutboundEnabled(): boolean {
  return /^(1|true|yes)$/i.test(process.env.VOICE_OUTBOUND_ENABLED ?? "");
}

function blocked(reason: GateBlockReason): GateResult {
  return { eligible: false, reason };
}

/** Authoritative per-dial eligibility check. Call this immediately before any dial. */
export async function preDialGate(contactId: string): Promise<GateResult> {
  if (!voiceOutboundEnabled()) return blocked("system_disabled");

  const supabase = createServiceRoleClient();
  const { data, error } = await (supabase as unknown as {
    rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
  }).rpc("pre_dial_gate", { p_contact_id: contactId });

  if (error || !data || typeof data !== "object") return blocked("no_consent");
  const r = data as { eligible?: boolean; reason?: string; phone?: string; disclosure?: string };
  if (r.eligible) {
    return { eligible: true, reason: "ok", phone: r.phone, disclosure: r.disclosure };
  }
  return blocked((r.reason as GateBlockReason) ?? "no_consent");
}
