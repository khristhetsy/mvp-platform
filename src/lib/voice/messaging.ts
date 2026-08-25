// Channel-aware messaging gate + send (SMS / WhatsApp). Mirrors the voice
// pre_dial_gate discipline: nothing sends without live consent for THAT channel,
// off the DNC list, inside recipient-local hours, jurisdiction cleared. Every
// send passes messageGate first. Service-role only; behind the master kill-switch.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { voiceOutboundEnabled } from "@/lib/voice/gate";
import { sendTwilioMessage, type MessageChannel } from "@/lib/voice/twilio";

function raw(c: SupabaseClient<Database>): SupabaseClient {
  return c as unknown as SupabaseClient;
}

export interface MessageGateResult {
  eligible: boolean;
  reason?: string;
  phone?: string | null;
}

const EU_JURISDICTIONS = new Set(["EU", "FR", "DE", "ES", "IT", "NL", "IE", "BE", "PT", "AT", "FI", "SE", "DK", "PL"]);

/** Local hour (0–23) in a timezone; null if the tz is invalid. */
function localHour(tz: string | null): number | null {
  if (!tz) return null;
  try {
    return Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: tz }).format(new Date()));
  } catch {
    return null;
  }
}

/** Consent + DNC + hours + jurisdiction check for one messaging channel. */
export async function messageGate(contactId: string, channel: MessageChannel): Promise<MessageGateResult> {
  if (!voiceOutboundEnabled()) return { eligible: false, reason: "system_disabled" };
  const supabase = raw(createServiceRoleClient());
  const nowIso = new Date().toISOString();

  const { data: consent } = await supabase
    .from("consent_records")
    .select("phone, call_timezone, jurisdiction, expires_at")
    .eq("contact_id", contactId)
    .eq("channel", channel)
    .is("revoked_at", null)
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
    .maybeSingle();
  if (!consent) return { eligible: false, reason: "no_consent" };

  const c = consent as { phone: string | null; call_timezone: string | null; jurisdiction: string | null };
  if (c.jurisdiction && EU_JURISDICTIONS.has(c.jurisdiction.toUpperCase())) return { eligible: false, reason: "jurisdiction_blocked" };

  // Phone: consent record first, else the CRM contact.
  let phone = c.phone ?? null;
  if (!phone) {
    const { data: crm } = await supabase.from("crm_contacts").select("phone, raw").eq("source", "odoo").eq("external_id", contactId).maybeSingle();
    const row = crm as { phone: string | null; raw: Record<string, unknown> | null } | null;
    phone = row?.phone ?? (row?.raw?.phone as string) ?? (row?.raw?.mobile as string) ?? null;
  }
  if (!phone) return { eligible: false, reason: "no_phone" };

  const { data: dnc } = await supabase.from("dnc_list").select("id").eq("number", phone).in("scope", [channel, "all"]).limit(1);
  if (dnc && dnc.length > 0) return { eligible: false, reason: "dnc" };

  const hour = localHour(c.call_timezone);
  if (hour === null) return { eligible: false, reason: "no_timezone" };
  if (hour < 8 || hour >= 21) return { eligible: false, reason: "outside_hours" };

  return { eligible: true, phone };
}

export interface SendMessageResult {
  ok: boolean;
  sid?: string;
  reason?: string;
}

/** Gate, send via Twilio, and log a unified outreach touch. */
export async function sendMessage(contactId: string, channel: MessageChannel, body: string, opts: { campaignId?: string | null } = {}): Promise<SendMessageResult> {
  const gate = await messageGate(contactId, channel);
  if (!gate.eligible || !gate.phone) return { ok: false, reason: gate.reason };

  const { sid } = await sendTwilioMessage(channel, gate.phone, body);

  const supabase = raw(createServiceRoleClient());
  await supabase.from("outreach_touches").insert({
    contact_id: contactId,
    channel,
    direction: "outbound",
    campaign_id: opts.campaignId ?? null,
    summary: `${channel.toUpperCase()} sent — “${body.slice(0, 60)}${body.length > 60 ? "…" : ""}”`,
  }).then(() => undefined, () => undefined);

  return { ok: true, sid };
}

/** Opt-out from an inbound STOP: DNC (all channels) + revoke consent everywhere. */
export async function optOutByNumber(number: string, contactId?: string | null): Promise<void> {
  const supabase = raw(createServiceRoleClient());
  await supabase.from("dnc_list").upsert({ number, scope: "all", reason: "inbound_stop" }, { onConflict: "number,scope" });
  if (contactId) {
    await supabase.from("consent_records").update({ revoked_at: new Date().toISOString() }).eq("contact_id", contactId).is("revoked_at", null);
  } else {
    await supabase.from("consent_records").update({ revoked_at: new Date().toISOString() }).eq("phone", number).is("revoked_at", null);
  }
}
