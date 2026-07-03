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

/** Place one outbound call through Vapi to a phone number in E.164 format. */
export async function placeVapiCall(toNumber: string): Promise<{ callId: string }> {
  if (!vapiConfigured()) throw new Error("Vapi is not configured (set VAPI_API_KEY, VAPI_PHONE_NUMBER_ID, VAPI_ASSISTANT_ID).");
  const res = await fetch("https://api.vapi.ai/call", {
    method: "POST",
    headers: { Authorization: `Bearer ${VAPI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      assistantId: VAPI_ASSISTANT_ID,
      phoneNumberId: VAPI_PHONE_NUMBER_ID,
      customer: { number: toNumber },
    }),
  });
  const json = (await res.json().catch(() => ({}))) as { id?: string; message?: string; error?: string };
  if (!res.ok) throw new Error(json.message || json.error || `Vapi returned ${res.status}`);
  return { callId: String(json.id ?? "") };
}
