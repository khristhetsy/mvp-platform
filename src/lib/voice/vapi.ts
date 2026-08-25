// Vapi connector — iCapOS tells Vapi to place an outbound call. Vapi owns the
// phone, voice, and assistant; iCapOS owns the compliance gate that runs BEFORE
// any call is triggered. Env-gated; dormant until the Vapi vars are set.

const VAPI_API_KEY = process.env.VAPI_API_KEY?.trim();
const VAPI_PHONE_NUMBER_ID = process.env.VAPI_PHONE_NUMBER_ID?.trim();
const VAPI_ASSISTANT_ID = process.env.VAPI_ASSISTANT_ID?.trim();
/** A single verified number allowed for in-app test dials (your own cell). */
export const VAPI_TEST_NUMBER = process.env.VAPI_TEST_NUMBER?.trim() || null;

export function vapiConfigured(): boolean {
  return Boolean(VAPI_API_KEY && VAPI_PHONE_NUMBER_ID && VAPI_ASSISTANT_ID);
}

export interface PlaceCallOptions {
  /** Echoed back to the agent + call-end webhooks (contactId, campaignId, variantId). */
  metadata?: Record<string, unknown>;
  /** The A/B variant opener script, injected as a template variable for the agent. */
  opener?: string | null;
}

/** Place one outbound call through Vapi to a phone number in E.164 format. The
 *  optional metadata (campaign + A/B variant) rides along so the runtime echoes
 *  it to our webhooks, and the variant opener is passed as a template variable. */
export async function placeVapiCall(toNumber: string, opts: PlaceCallOptions = {}): Promise<{ callId: string }> {
  if (!vapiConfigured()) throw new Error("Vapi is not configured (set VAPI_API_KEY, VAPI_PHONE_NUMBER_ID, VAPI_ASSISTANT_ID).");
  const res = await fetch("https://api.vapi.ai/call", {
    method: "POST",
    headers: { Authorization: `Bearer ${VAPI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      assistantId: VAPI_ASSISTANT_ID,
      phoneNumberId: VAPI_PHONE_NUMBER_ID,
      customer: { number: toNumber },
      ...(opts.metadata ? { metadata: opts.metadata } : {}),
      ...(opts.opener
        ? { assistantOverrides: { variableValues: { opener: opts.opener, ...(opts.metadata ?? {}) } } }
        : {}),
    }),
  });
  const json = (await res.json().catch(() => ({}))) as { id?: string; message?: string; error?: string };
  if (!res.ok) throw new Error(json.message || json.error || `Vapi returned ${res.status}`);
  return { callId: String(json.id ?? "") };
}
