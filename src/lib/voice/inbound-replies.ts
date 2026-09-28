// Inbound SMS / WhatsApp replies that are not STOP. Until now the webhook only
// handled opt-outs, so any other reply was dropped and nobody saw it. Here a
// reply is matched to its contact, logged on the contact's timeline, raised to
// staff in-app, and emailed to the reply inbox when one is configured.
// Service-role only. Best-effort: a failure here never breaks the webhook.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { createServiceRoleClient } from "@/lib/supabase/admin";
import { notifyStaffIfNotRecent } from "@/lib/notifications/notifications";
import { sendEmail, parseRecipients } from "@/lib/email/send-email";
import { renderEmail, type RenderedEmail } from "@/lib/email/layout";
import type { MessageChannel } from "@/lib/voice/twilio";

function raw(c: SupabaseClient<Database>): SupabaseClient {
  return c as unknown as SupabaseClient;
}

export type InboundReply = {
  channel: MessageChannel;
  from: string;
  body: string;
  contactId: string | null;
  contactName: string | null;
  campaignName: string | null;
};

function appOrigin(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "https://icapos.com").replace(/\/+$/, "");
}

/** Where a reply should send staff: the contact's record, else the voice console. */
export function replyPath(contactId: string | null): string {
  return contactId ? `/admin/crm/record/${encodeURIComponent(contactId)}` : "/admin/voice";
}

/** Who gets reply emails. Unset means in-app only. */
export function replyInbox(): string[] {
  return parseRecipients(process.env.SMS_REPLY_NOTIFY_EMAIL ?? process.env.ADMIN_SUPPORT_EMAIL ?? null);
}

/** The staff email for one reply. Pure. */
export function buildSmsReplyEmail(r: InboundReply): RenderedEmail {
  const kind = r.channel === "whatsapp" ? "WhatsApp" : "Text";
  const who = r.contactName ?? r.from;
  return renderEmail({
    audience: "admin",
    subject: `${kind} reply from ${who}`,
    preheader: r.body.replace(/\s+/g, " ").slice(0, 140),
    context: r.campaignName ?? "Outreach",
    eyebrow: `${kind} reply`,
    headline: `${who} replied`,
    intro: `${who} replied to ${r.campaignName ? `the "${r.campaignName}" follow-up` : "an iCFO follow-up"}. Replying to this email does not reach them: call or text them back from your usual line.`,
    blocks: [
      { type: "quote", label: who, meta: r.from, text: r.body },
      {
        type: "facts",
        rows: [
          { label: "From", value: r.from },
          { label: "Contact", value: r.contactName ?? "Not matched to a CRM contact" },
          ...(r.campaignName ? [{ label: "Campaign", value: r.campaignName }] : []),
        ],
      },
    ],
    primary: { label: r.contactId ? "Open contact" : "Open the voice console", url: `${appOrigin()}${replyPath(r.contactId)}` },
    footer: { reason: "Internal. Sent to the outreach reply inbox (SMS_REPLY_NOTIFY_EMAIL) for every inbound text that is not STOP." },
  });
}

/** Match a phone number to a contact: consent record first, then the CRM. */
async function findContact(db: SupabaseClient, phone: string): Promise<{ id: string | null; name: string | null }> {
  const { data: consent } = await db.from("consent_records").select("contact_id").eq("phone", phone).limit(1).maybeSingle();
  let id = (consent as { contact_id: string | null } | null)?.contact_id ?? null;
  let name: string | null = null;

  const q = db.from("crm_contacts").select("external_id, name").eq("source", "odoo");
  const { data: crm } = id
    ? await q.eq("external_id", id).maybeSingle()
    : await q.or(`phone.eq.${phone},raw->>phone.eq.${phone},raw->>mobile.eq.${phone}`).limit(1).maybeSingle();
  const row = crm as { external_id: string | null; name: string | null } | null;
  if (row) {
    id = id ?? row.external_id;
    name = row.name?.trim() || null;
  }
  return { id, name };
}

async function lastCampaignName(db: SupabaseClient, contactId: string | null): Promise<string | null> {
  if (!contactId) return null;
  const { data: touch } = await db
    .from("outreach_touches")
    .select("campaign_id")
    .eq("contact_id", contactId)
    .eq("direction", "outbound")
    .not("campaign_id", "is", null)
    .order("occurred_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const campaignId = (touch as { campaign_id: string | null } | null)?.campaign_id;
  if (!campaignId) return null;
  const { data: camp } = await db.from("voice_campaigns").select("name").eq("id", campaignId).maybeSingle();
  return (camp as { name: string } | null)?.name ?? null;
}

/** Handle one inbound reply that is not an opt-out. */
export async function handleInboundReply(input: { channel: MessageChannel; from: string; body: string }): Promise<void> {
  const body = input.body.trim();
  if (!input.from || !body) return;
  const db = raw(createServiceRoleClient());

  const contact = await findContact(db, input.from).catch(() => ({ id: null, name: null }));
  const campaignName = await lastCampaignName(db, contact.id).catch(() => null);
  const reply: InboundReply = { channel: input.channel, from: input.from, body, contactId: contact.id, contactName: contact.name, campaignName };
  const kind = input.channel === "whatsapp" ? "WhatsApp" : "SMS";

  if (contact.id) {
    await db
      .from("outreach_touches")
      .insert({ contact_id: contact.id, channel: input.channel, direction: "inbound", summary: `${kind} reply: "${body.slice(0, 120)}${body.length > 120 ? "…" : ""}"` })
      .then(() => undefined, () => undefined);
  }

  await notifyStaffIfNotRecent({
    type: "sms_reply",
    title: `${kind} reply from ${contact.name ?? input.from}`,
    message: body.slice(0, 300),
    entityType: "crm_contact",
    entityId: contact.id ?? input.from,
    severity: "info",
    deepLink: replyPath(contact.id),
    withinHours: 0,
  }).catch(() => undefined);

  const to = replyInbox();
  if (to.length) {
    const mail = buildSmsReplyEmail(reply);
    await sendEmail({ to, subject: mail.subject, html: mail.html, text: mail.text, fromName: "iCapOS Ops" }).catch(() => false);
  }
}
