// Adapters between Vapi's wire format and our webhook shapes. Vapi posts server
// messages as { message: { type, call, artifact, ... } }; our routes accept flat
// bodies. These unwrap Vapi's envelope so the same endpoints serve both a direct
// caller (tests) and Vapi. Pure functions — no I/O.

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Vapi endedReason → our disposition vocabulary. */
export function endedReasonToDisposition(reason: string | undefined | null): string {
  const r = (reason ?? "").toLowerCase();
  if (!r) return "completed";
  if (r.includes("no-answer") || r.includes("no_answer")) return "no_answer";
  if (r.includes("voicemail")) return "voicemail";
  if (r.includes("busy")) return "busy";
  if (r.includes("forward") || r.includes("transfer")) return "transferred";
  if (r.includes("customer-ended") || r.includes("customer-did-hangup")) return "completed";
  if (r.includes("assistant-ended")) return "completed";
  if (r.includes("failed") || r.includes("error")) return "failed";
  return "completed";
}

/** Vapi status-update status → our live-monitor status (null = drop, e.g. ended). */
export function vapiStatusToLive(status: string | undefined | null): "ringing" | "talking" | "transferring" | "ending" | null {
  switch ((status ?? "").toLowerCase()) {
    case "ringing":
    case "queued":
    case "scheduled":
      return "ringing";
    case "in-progress":
      return "talking";
    case "forwarding":
      return "transferring";
    case "ended":
      return null; // call-end webhook removes the row
    default:
      return null;
  }
}

function meta(call: any): Record<string, any> {
  return (call?.metadata ?? call?.assistantOverrides?.metadata ?? {}) as Record<string, any>;
}

/** Map a Vapi end-of-call-report to the flat call-end body our route expects. */
export function unwrapVapiCallEnd(vapi: any): Record<string, unknown> | null {
  const m = vapi?.message;
  if (!m || m.type !== "end-of-call-report") return null;
  const call = m.call ?? {};
  const md = meta(call);
  const recording = m.artifact?.recording ?? {};
  const recordingUrl = recording.stereoUrl || recording.url || recording.mono?.combinedUrl || null;
  const duration = typeof m.durationSeconds === "number" ? Math.round(m.durationSeconds)
    : typeof m.duration === "number" ? Math.round(m.duration) : null;
  return {
    contactId: md.contactId ?? md.contact_id ?? "",
    callId: call.id ?? null,
    campaignId: md.campaignId ?? md.campaign_id ?? null,
    variantId: md.variantId ?? md.variant_id ?? null,
    disposition: endedReasonToDisposition(m.endedReason),
    status: m.endedReason ?? null,
    transferredTo: m.endedReason?.toLowerCase().includes("forward") ? "human" : null,
    duration,
    recordingUrl: typeof recordingUrl === "string" ? recordingUrl : null,
    cost: typeof m.cost === "number" ? m.cost : null,
  };
}

/** Map a Vapi status-update to the flat call-status body our route expects. */
export function unwrapVapiStatus(vapi: any): Record<string, unknown> | null {
  const m = vapi?.message;
  if (!m || m.type !== "status-update") return null;
  const live = vapiStatusToLive(m.status);
  if (!live) return null; // ended / unknown — nothing to upsert
  const call = m.call ?? {};
  const md = meta(call);
  const customer = call.customer ?? {};
  return {
    callId: call.id ?? "",
    status: live,
    contactId: md.contactId ?? md.contact_id ?? null,
    campaignId: md.campaignId ?? md.campaign_id ?? null,
    variantId: md.variantId ?? md.variant_id ?? null,
    contactName: md.contactName ?? customer.name ?? null,
    company: md.company ?? null,
    variantLabel: md.variantLabel ?? null,
  };
}
