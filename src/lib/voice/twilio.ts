// Twilio connector for the multichannel cadence (SMS + WhatsApp). iCapOS owns
// the consent gate that runs BEFORE any message; Twilio only carries it.
// Env-gated; dormant until the Twilio vars are set.

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID?.trim();
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN?.trim();
const TWILIO_SMS_FROM = process.env.TWILIO_SMS_FROM?.trim();
/** WhatsApp sender in `whatsapp:+1…` form (Twilio sandbox or approved sender). */
const TWILIO_WHATSAPP_FROM = process.env.TWILIO_WHATSAPP_FROM?.trim();
/** A single verified number allowed for in-app test messages (your own cell). */
export const TWILIO_TEST_NUMBER = process.env.TWILIO_TEST_NUMBER?.trim() || null;

export type MessageChannel = "sms" | "whatsapp";

export function twilioConfigured(channel: MessageChannel): boolean {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) return false;
  return channel === "whatsapp" ? Boolean(TWILIO_WHATSAPP_FROM) : Boolean(TWILIO_SMS_FROM);
}

/** Send one message via Twilio. Numbers in E.164; WhatsApp gets the whatsapp: prefix. */
export async function sendTwilioMessage(channel: MessageChannel, toNumber: string, body: string): Promise<{ sid: string }> {
  if (!twilioConfigured(channel)) throw new Error(`Twilio ${channel} is not configured.`);
  const from = channel === "whatsapp" ? TWILIO_WHATSAPP_FROM! : TWILIO_SMS_FROM!;
  const to = channel === "whatsapp" ? `whatsapp:${toNumber}` : toNumber;

  const form = new URLSearchParams({ To: to, From: from, Body: body });
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });
  const json = (await res.json().catch(() => ({}))) as { sid?: string; message?: string };
  if (!res.ok) throw new Error(json.message || `Twilio returned ${res.status}`);
  return { sid: String(json.sid ?? "") };
}
